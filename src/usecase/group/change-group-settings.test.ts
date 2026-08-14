import { describe, expect, it } from 'vitest'
import { toGroupId } from '../../domain/id'
import { groupOf, hanako, jiro, taro } from '../fixture'
import { fakeGroupRepository } from '../port/fake'
import { changeGroupSettings } from './change-group-settings'

const deps = () => ({
  groups: fakeGroupRepository([
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
  ]),
})

const stored = (groups: ReturnType<typeof fakeGroupRepository>) => {
  const group = groups.stored()[0]
  if (group === undefined) throw new Error('前提の Group が無い')
  return group
}

describe('グループ設定を変更する', () => {
  it('名前と既定通貨を変更できる', async () => {
    const d = deps()

    const result = await changeGroupSettings(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      name: '石垣島旅行',
      defaultCurrency: 'USD',
    })

    expect(result.ok).toBe(true)
    expect(stored(d.groups).name).toBe('石垣島旅行')
    expect(stored(d.groups).defaultCurrency).toBe('USD')
  })

  it('渡さなかった属性は変わらない', async () => {
    const d = deps()

    await changeGroupSettings(d)({ actor: taro.id, group: toGroupId('g1'), name: '石垣島旅行' })

    expect(stored(d.groups).defaultCurrency).toBe('JPY')
  })

  it('参加コードは変わらない', async () => {
    const d = deps()

    await changeGroupSettings(d)({ actor: taro.id, group: toGroupId('g1'), name: '石垣島旅行' })

    expect(stored(d.groups).inviteCode).toBe('invite-1')
  })

  it('Member は変わらない', async () => {
    const d = deps()

    await changeGroupSettings(d)({ actor: taro.id, group: toGroupId('g1'), defaultCurrency: 'USD' })

    expect(stored(d.groups).members.map((member) => member.userId)).toEqual([taro.id, jiro.id])
  })

  it('その Group の Member でなければ失敗し、何も変わらない', async () => {
    const d = deps()

    const result = await changeGroupSettings(d)({
      actor: hanako.id,
      group: toGroupId('g1'),
      name: '石垣島旅行',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
    expect(stored(d.groups).name).toBe('沖縄旅行')
  })

  it('Group が存在しなければ、Member でないことと区別して伝える', async () => {
    const d = deps()

    const result = await changeGroupSettings(d)({
      actor: taro.id,
      group: toGroupId('いない'),
      name: '石垣島旅行',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notFound' } })
  })

  it('ログインしていなければ、対象の有無に依らず未ログインとして伝える', async () => {
    const d = deps()

    const result = await changeGroupSettings(d)({
      actor: undefined,
      group: toGroupId('いない'),
      name: '石垣島旅行',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
  })

  it('名前が上限を超えていれば失敗し、何も変わらない', async () => {
    const d = deps()

    const result = await changeGroupSettings(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      name: 'あ'.repeat(51),
    })

    expect(result).toEqual({ ok: false, error: { kind: 'groupNameTooLong' } })
    expect(stored(d.groups).name).toBe('沖縄旅行')
  })

  it('扱えない通貨コードは既定通貨にできない', async () => {
    const d = deps()

    const result = await changeGroupSettings(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      defaultCurrency: 'XAU',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'currencyUnsupported' } })
    expect(stored(d.groups).defaultCurrency).toBe('JPY')
  })
})

import { describe, expect, it } from 'vitest'
import { toUserId } from '../../domain/id'
import { taro } from '../fixture'
import {
  fakeGroupRepository,
  fakeIdGenerator,
  fakeInviteCodeGenerator,
  fakeUserRepository,
} from '../port/fake'
import { createGroup } from './create-group'

const deps = (overrides: { inviteCodes?: readonly string[] } = {}) => {
  const groups = fakeGroupRepository()
  const users = fakeUserRepository([taro])

  return {
    groups,
    users,
    ids: fakeIdGenerator(),
    inviteCodes: fakeInviteCodeGenerator(...(overrides.inviteCodes ?? [])),
  }
}

describe('グループを作成する', () => {
  it('Group ができ、作成者が Member になる', async () => {
    const d = deps({ inviteCodes: ['invite-1'] })

    const result = await createGroup(d)({ actor: taro.id, name: '沖縄旅行', defaultCurrency: 'JPY' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.name).toBe('沖縄旅行')
    expect(result.value.defaultCurrency).toBe('JPY')
    expect(result.value.inviteCode).toBe('invite-1')
    expect(result.value.members).toHaveLength(1)
    expect(result.value.members[0]?.userId).toBe(taro.id)
    // 表示名の初期値には、その User の名前を使う。
    expect(result.value.members[0]?.displayName).toBe('たろう')
  })

  it('保存される', async () => {
    const d = deps()

    await createGroup(d)({ actor: taro.id, name: '沖縄旅行', defaultCurrency: 'JPY' })

    expect(d.groups.stored()).toHaveLength(1)
  })

  it('作成者以外の Member は作られない', async () => {
    const d = deps()

    const result = await createGroup(d)({ actor: taro.id, name: '沖縄旅行', defaultCurrency: 'JPY' })

    expect(result.ok && result.value.members.map((member) => member.userId)).toEqual([taro.id])
  })

  it('ログインしていなければ失敗し、Group は作られない', async () => {
    const d = deps()

    const result = await createGroup(d)({
      actor: undefined,
      name: '沖縄旅行',
      defaultCurrency: 'JPY',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.groups.stored()).toHaveLength(0)
  })

  it('操作する User が存在しなければ、ログインしていないものとして扱う', async () => {
    const d = deps()

    const result = await createGroup(d)({
      actor: toUserId('いない'),
      name: '沖縄旅行',
      defaultCurrency: 'JPY',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.groups.stored()).toHaveLength(0)
  })

  it('名前が空なら失敗し、Group は作られない', async () => {
    const d = deps()

    const result = await createGroup(d)({ actor: taro.id, name: '   ', defaultCurrency: 'JPY' })

    expect(result).toEqual({ ok: false, error: { kind: 'groupNameEmpty' } })
    expect(d.groups.stored()).toHaveLength(0)
  })

  it('扱えない通貨コードは既定通貨にできない', async () => {
    const d = deps()

    const result = await createGroup(d)({ actor: taro.id, name: '沖縄旅行', defaultCurrency: 'XAU' })

    expect(result).toEqual({ ok: false, error: { kind: 'currencyUnsupported' } })
    expect(d.groups.stored()).toHaveLength(0)
  })

  describe('参加コードが衝突したとき', () => {
    it('生成し直してから作成を完了する', async () => {
      const groups = fakeGroupRepository()
      const users = fakeUserRepository([taro])
      const ids = fakeIdGenerator()

      // 1 つ目のグループが `invite-1` を使う。
      await createGroup({
        groups,
        users,
        ids,
        inviteCodes: fakeInviteCodeGenerator('invite-1'),
      })({ actor: taro.id, name: '沖縄旅行', defaultCurrency: 'JPY' })

      // 2 つ目は 1 回目に同じコードを引き当てるが、生成し直して通る。
      const result = await createGroup({
        groups,
        users,
        ids,
        inviteCodes: fakeInviteCodeGenerator('invite-1', 'invite-2'),
      })({ actor: taro.id, name: '北海道旅行', defaultCurrency: 'JPY' })

      expect(result.ok && result.value.inviteCode).toBe('invite-2')
      expect(groups.stored()).toHaveLength(2)
    })

    it('生成し直しても空きが見つからなければ失敗する', async () => {
      const groups = fakeGroupRepository()
      const users = fakeUserRepository([taro])
      const ids = fakeIdGenerator()
      const always = { next: () => 'invite-1' }

      await createGroup({ groups, users, ids, inviteCodes: always })({
        actor: taro.id,
        name: '沖縄旅行',
        defaultCurrency: 'JPY',
      })

      const result = await createGroup({ groups, users, ids, inviteCodes: always })({
        actor: taro.id,
        name: '北海道旅行',
        defaultCurrency: 'JPY',
      })

      expect(result).toEqual({ ok: false, error: { kind: 'inviteCodeUnavailable' } })
      expect(groups.stored()).toHaveLength(1)
    })
  })
})

import { describe, expect, it } from 'vitest'
import { Member } from '../../domain/group/member'
import { toGroupId, toMemberId } from '../../domain/id'
import { groupOf, hanako, jiro, taro } from '../fixture'
import { fakeGroupRepository } from '../port/fake'
import { changeDisplayName } from './change-display-name'

const deps = () => ({
  groups: fakeGroupRepository([
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
    // 同じ User が別の Group にも参加している。
    groupOf([{ user: taro, memberId: 'm3' }], { id: 'g2', inviteCode: 'invite-2' }),
  ]),
})

const stored = (groups: ReturnType<typeof fakeGroupRepository>, id: string) => {
  const group = groups.stored().find((it) => it.id === toGroupId(id))
  if (group === undefined) throw new Error('前提の Group が無い')
  return group
}

describe('表示名を変更する', () => {
  it('その Member の表示名が変わる', async () => {
    const d = deps()

    const result = await changeDisplayName(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      member: toMemberId('m1'),
      displayName: 'たろちゃん',
    })

    expect(result.ok).toBe(true)
    expect(Member.byId(stored(d.groups, 'g1').members, toMemberId('m1'))?.displayName).toBe(
      'たろちゃん',
    )
  })

  it('同じ User の、他のグループの Member の表示名は変わらない', async () => {
    const d = deps()

    await changeDisplayName(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      member: toMemberId('m1'),
      displayName: 'たろちゃん',
    })

    expect(Member.byId(stored(d.groups, 'g2').members, toMemberId('m3'))?.displayName).toBe('たろう')
  })

  it('他の Member の表示名も変えられる', async () => {
    const d = deps()

    const result = await changeDisplayName(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      member: toMemberId('m2'),
      displayName: 'じろちゃん',
    })

    expect(result.ok).toBe(true)
    expect(Member.byId(stored(d.groups, 'g1').members, toMemberId('m2'))?.displayName).toBe(
      'じろちゃん',
    )
  })

  it('同じグループの他の Member の表示名は巻き添えにならない', async () => {
    const d = deps()

    await changeDisplayName(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      member: toMemberId('m1'),
      displayName: 'たろちゃん',
    })

    expect(Member.byId(stored(d.groups, 'g1').members, toMemberId('m2'))?.displayName).toBe('じろう')
  })

  it('対象がそのグループの Member でなければ失敗する', async () => {
    const d = deps()

    const result = await changeDisplayName(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      member: toMemberId('m3'),
      displayName: 'たろちゃん',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
  })

  it('操作する User がそのグループの Member でなければ失敗する', async () => {
    const d = deps()

    const result = await changeDisplayName(d)({
      actor: hanako.id,
      group: toGroupId('g1'),
      member: toMemberId('m1'),
      displayName: 'たろちゃん',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
    expect(Member.byId(stored(d.groups, 'g1').members, toMemberId('m1'))?.displayName).toBe('たろう')
  })

  it('表示名が空なら失敗し、何も変わらない', async () => {
    const d = deps()

    const result = await changeDisplayName(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      member: toMemberId('m1'),
      displayName: '   ',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'displayNameEmpty' } })
    expect(Member.byId(stored(d.groups, 'g1').members, toMemberId('m1'))?.displayName).toBe('たろう')
  })
})

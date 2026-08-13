import { describe, expect, it } from 'vitest'
import { Member } from '../../domain/group/member'
import { groupOf, hanako, jiro, taro } from '../fixture'
import { fakeGroupRepository, fakeIdGenerator, fakeUserRepository } from '../port/fake'
import { joinGroup } from './join-group'

const deps = () => ({
  groups: fakeGroupRepository([groupOf([{ user: taro, memberId: 'm1' }])]),
  users: fakeUserRepository([taro, jiro, hanako]),
  ids: fakeIdGenerator('m'),
})

const stored = (groups: ReturnType<typeof fakeGroupRepository>) => {
  const group = groups.stored()[0]
  if (group === undefined) throw new Error('前提の Group が無い')
  return group
}

describe('グループに参加する', () => {
  it('Member ができる', async () => {
    const d = deps()

    const result = await joinGroup(d)({
      actor: jiro.id,
      inviteCode: 'invite-1',
      displayName: 'じろちゃん',
    })

    expect(result.ok).toBe(true)
    expect(stored(d.groups).members).toHaveLength(2)
    expect(Member.byUser(stored(d.groups).members, jiro.id)?.displayName).toBe('じろちゃん')
  })

  it('既存の Member の内容は変わらない', async () => {
    const d = deps()

    await joinGroup(d)({ actor: jiro.id, inviteCode: 'invite-1', displayName: 'じろちゃん' })

    expect(Member.byUser(stored(d.groups).members, taro.id)?.displayName).toBe('たろう')
  })

  describe('既に Member のとき', () => {
    it('新しい Member は作らない', async () => {
      const d = deps()

      const result = await joinGroup(d)({
        actor: taro.id,
        inviteCode: 'invite-1',
        displayName: 'たろちゃん',
      })

      expect(result.ok).toBe(true)
      expect(stored(d.groups).members).toHaveLength(1)
    })

    it('入力された表示名は反映しない', async () => {
      const d = deps()

      await joinGroup(d)({ actor: taro.id, inviteCode: 'invite-1', displayName: 'たろちゃん' })

      expect(Member.byUser(stored(d.groups).members, taro.id)?.displayName).toBe('たろう')
    })
  })

  it('2 人が続けて参加すると、どちらも Member になる', async () => {
    const d = deps()

    await joinGroup(d)({ actor: jiro.id, inviteCode: 'invite-1', displayName: 'じろう' })
    await joinGroup(d)({ actor: hanako.id, inviteCode: 'invite-1', displayName: 'はなこ' })

    expect(stored(d.groups).members.map((member) => member.userId)).toEqual([
      taro.id,
      jiro.id,
      hanako.id,
    ])
  })

  it('参加コードに対応する Group が無ければ、見つからないとして失敗する', async () => {
    const d = deps()

    const result = await joinGroup(d)({
      actor: jiro.id,
      inviteCode: 'いないコード',
      displayName: 'じろう',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notFound' } })
    expect(stored(d.groups).members).toHaveLength(1)
  })

  it('ログインしていなければ失敗し、Member は作られない', async () => {
    const d = deps()

    const result = await joinGroup(d)({
      actor: undefined,
      inviteCode: 'invite-1',
      displayName: 'じろう',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(stored(d.groups).members).toHaveLength(1)
  })

  it('表示名が上限を超えていれば失敗し、Member は作られない', async () => {
    const d = deps()

    const result = await joinGroup(d)({
      actor: jiro.id,
      inviteCode: 'invite-1',
      displayName: 'あ'.repeat(21),
    })

    expect(result).toEqual({ ok: false, error: { kind: 'displayNameTooLong' } })
    expect(stored(d.groups).members).toHaveLength(1)
  })
})

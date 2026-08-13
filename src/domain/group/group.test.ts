import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId, toUserId } from '../id'
import { Group } from './group'
import { Member } from './member'
import { User } from './user'

const userOf = (id: string, name: string) => {
  const user = User.create({ id: toUserId(id), name, loginIdentifier: `google:${id}` })
  if (!user.ok) throw new Error('前提の User を作れなかった')
  return user.value
}

const taro = userOf('u1', 'たろう')
const jiro = userOf('u2', 'じろう')

const groupOf = (
  overrides: { id?: string; name?: string; defaultCurrency?: string; inviteCode?: string } = {},
) => {
  const group = Group.create({
    id: toGroupId(overrides.id ?? 'g1'),
    name: overrides.name ?? '沖縄旅行',
    defaultCurrency: overrides.defaultCurrency ?? 'JPY',
    inviteCode: overrides.inviteCode ?? 'invite-1',
    creator: taro,
    creatorMemberId: toMemberId('m1'),
  })
  if (!group.ok) throw new Error('前提の Group を作れなかった')
  return group.value
}

const joined = (...args: Parameters<typeof Group.join>) => {
  const group = Group.join(...args)
  if (!group.ok) throw new Error('前提の参加に失敗した')
  return group.value
}

describe('Group', () => {
  describe('グループを作成する', () => {
    it('名前・既定通貨・参加コードを持つ Group ができる', () => {
      const group = groupOf()

      expect(group.id).toBe(toGroupId('g1'))
      expect(group.name).toBe('沖縄旅行')
      expect(group.defaultCurrency).toBe('JPY')
      expect(group.inviteCode).toBe('invite-1')
    })

    it('作成者が Member になる', () => {
      const group = groupOf()

      expect(group.members).toHaveLength(1)
      expect(group.members[0]).toEqual({
        id: toMemberId('m1'),
        groupId: toGroupId('g1'),
        userId: taro.id,
        displayName: 'たろう',
      })
    })

    it('作成者の表示名の初期値は、その User の名前', () => {
      const group = Group.create({
        id: toGroupId('g1'),
        name: '沖縄旅行',
        defaultCurrency: 'JPY',
        inviteCode: 'invite-1',
        creator: userOf('u9', 'はなこ'),
        creatorMemberId: toMemberId('m1'),
      })

      expect(group.ok && group.value.members[0]?.displayName).toBe('はなこ')
    })

    it('作成者以外の Member は作られない', () => {
      expect(groupOf().members.map((member) => member.userId)).toEqual([taro.id])
    })

    it('グループ名の前後の空白は落ちる', () => {
      expect(groupOf({ name: '  沖縄旅行  ' }).name).toBe('沖縄旅行')
    })

    it('グループ名は空にできない', () => {
      const group = Group.create({
        id: toGroupId('g1'),
        name: '   ',
        defaultCurrency: 'JPY',
        inviteCode: 'invite-1',
        creator: taro,
        creatorMemberId: toMemberId('m1'),
      })

      expect(group).toEqual({ ok: false, error: { kind: 'groupNameEmpty' } })
    })

    it('グループ名は 50 文字以内', () => {
      expect(groupOf({ name: 'あ'.repeat(50) }).name).toHaveLength(50)

      const tooLong = Group.create({
        id: toGroupId('g1'),
        name: 'あ'.repeat(51),
        defaultCurrency: 'JPY',
        inviteCode: 'invite-1',
        creator: taro,
        creatorMemberId: toMemberId('m1'),
      })

      expect(tooLong).toEqual({ ok: false, error: { kind: 'groupNameTooLong' } })
    })

    it('既定通貨は渡されたものをそのまま持つ', () => {
      expect(groupOf({ defaultCurrency: 'USD' }).defaultCurrency).toBe('USD')
    })
  })

  describe('グループ設定を変更する', () => {
    it('Member ならグループ名を変えられる', () => {
      const changed = Group.changeSettings(groupOf(), { actor: taro.id, name: ' 北海道旅行 ' })

      expect(changed.ok && changed.value.name).toBe('北海道旅行')
    })

    it('Member なら既定通貨を変えられる', () => {
      const changed = Group.changeSettings(groupOf(), { actor: taro.id, defaultCurrency: 'USD' })

      expect(changed.ok && changed.value.defaultCurrency).toBe('USD')
    })

    it('渡さなかったものは変わらない', () => {
      const group = groupOf()
      const changed = Group.changeSettings(group, { actor: taro.id, name: '北海道旅行' })

      expect(changed.ok && changed.value.defaultCurrency).toBe(group.defaultCurrency)
    })

    it('変更前の値は残らない', () => {
      const changed = Group.changeSettings(groupOf(), { actor: taro.id, name: '北海道旅行' })

      expect(changed.ok && Object.values(changed.value)).not.toContain('沖縄旅行')
    })

    it('参加コードは変わらない', () => {
      const group = groupOf()
      const changed = Group.changeSettings(group, {
        actor: taro.id,
        name: '北海道旅行',
        defaultCurrency: 'USD',
      })

      expect(changed.ok && changed.value.inviteCode).toBe(group.inviteCode)
    })

    it('Member は変わらない', () => {
      const group = groupOf()
      const changed = Group.changeSettings(group, { actor: taro.id, name: '北海道旅行' })

      expect(changed.ok && changed.value.members).toEqual(group.members)
    })

    it('Member でなければ失敗し、Group は変わらない', () => {
      const group = groupOf()
      const changed = Group.changeSettings(group, { actor: jiro.id, name: '北海道旅行' })

      expect(changed).toEqual({ ok: false, error: { kind: 'notMember' } })
      expect(group.name).toBe('沖縄旅行')
    })

    it('ログインしていなければ失敗する', () => {
      expect(Group.changeSettings(groupOf(), { actor: undefined, name: '北海道旅行' })).toEqual({
        ok: false,
        error: { kind: 'notAuthenticated' },
      })
    })

    it('グループ名の制約は作成時と同じ', () => {
      const group = groupOf()

      expect(Group.changeSettings(group, { actor: taro.id, name: ' ' })).toEqual({
        ok: false,
        error: { kind: 'groupNameEmpty' },
      })
      expect(Group.changeSettings(group, { actor: taro.id, name: 'あ'.repeat(51) })).toEqual({
        ok: false,
        error: { kind: 'groupNameTooLong' },
      })
    })

    it('2 人が同時に変更しても失敗せず、後から届いた方が勝つ', () => {
      const group = groupOf()

      // どちらも同じ Group を見て変更する（版を持たないため、競合として弾かれない）
      const first = Group.changeSettings(group, { actor: taro.id, name: '北海道旅行' })
      const second = Group.changeSettings(group, { actor: taro.id, defaultCurrency: 'USD' })

      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      // 後から届いた方の内容がそのまま残る
      expect(second.ok && second.value.defaultCurrency).toBe('USD')
      expect(second.ok && second.value.name).toBe('沖縄旅行')
    })
  })

  describe('グループに参加する', () => {
    it('Member が増える', () => {
      const group = joined(groupOf(), { memberId: toMemberId('m2'), user: jiro, displayName: 'じ' })

      expect(group.members).toHaveLength(2)
      expect(Member.byUser(group.members, jiro.id)?.displayName).toBe('じ')
    })

    it('既存の Member の内容は変わらない', () => {
      const before = groupOf()
      const after = joined(before, {
        memberId: toMemberId('m2'),
        user: jiro,
        displayName: 'じろう',
      })

      expect(Member.byUser(after.members, taro.id)).toEqual(Member.byUser(before.members, taro.id))
    })

    it('二重に参加しても、新しい Member は作られない', () => {
      const group = groupOf()
      const again = joined(group, {
        memberId: toMemberId('m2'),
        user: taro,
        displayName: 'たろちゃん',
      })

      expect(again.members).toHaveLength(1)
      expect(again.members[0]?.id).toBe(toMemberId('m1'))
    })

    it('二重に参加したとき、入力された表示名は反映しない', () => {
      const group = groupOf()
      const again = joined(group, {
        memberId: toMemberId('m2'),
        user: taro,
        displayName: 'たろちゃん',
      })

      expect(Member.byUser(again.members, taro.id)?.displayName).toBe('たろう')
    })

    it('2 人が同時に参加した場合、どちらも Member になる', () => {
      const group = groupOf()
      const saburo = userOf('u3', 'さぶろう')

      // どちらも同じ Group を見て参加する。後から届いた方が失敗することはない
      const byJiro = Group.join(group, {
        memberId: toMemberId('m2'),
        user: jiro,
        displayName: 'じろう',
      })
      const bySaburo = Group.join(group, {
        memberId: toMemberId('m3'),
        user: saburo,
        displayName: 'さぶろう',
      })

      expect(byJiro.ok && Member.byUser(byJiro.value.members, jiro.id)).toBeDefined()
      expect(bySaburo.ok && Member.byUser(bySaburo.value.members, saburo.id)).toBeDefined()
    })

    it('表示名の制約は Member を作るときと同じ', () => {
      const group = groupOf()

      expect(Group.join(group, { memberId: toMemberId('m2'), user: jiro, displayName: '' })).toEqual(
        { ok: false, error: { kind: 'displayNameEmpty' } },
      )
      expect(
        Group.join(group, {
          memberId: toMemberId('m2'),
          user: jiro,
          displayName: 'あ'.repeat(21),
        }),
      ).toEqual({ ok: false, error: { kind: 'displayNameTooLong' } })
    })

    it('Member が 1 人だけのグループも成立する', () => {
      expect(groupOf().members).toHaveLength(1)
    })
  })

  describe('表示名を変更する', () => {
    it('その Member の表示名が変わる', () => {
      const group = groupOf()
      const changed = Group.changeDisplayName(group, {
        member: toMemberId('m1'),
        displayName: ' たろちゃん ',
      })

      expect(changed.ok && Member.byUser(changed.value.members, taro.id)?.displayName).toBe(
        'たろちゃん',
      )
    })

    it('他の Member は変わらない', () => {
      const group = joined(groupOf(), {
        memberId: toMemberId('m2'),
        user: jiro,
        displayName: 'じろう',
      })
      const changed = Group.changeDisplayName(group, {
        member: toMemberId('m1'),
        displayName: 'たろちゃん',
      })

      expect(changed.ok && Member.byUser(changed.value.members, jiro.id)?.displayName).toBe('じろう')
    })

    it('同じ User の、他のグループの Member の表示名は変わらない', () => {
      const okinawa = groupOf({ id: 'g1', inviteCode: 'invite-1' })
      const hokkaido = joined(groupOf({ id: 'g2', inviteCode: 'invite-2' }), {
        memberId: toMemberId('m2'),
        user: jiro,
        displayName: 'じろう',
      })

      const changed = Group.changeDisplayName(okinawa, {
        member: toMemberId('m1'),
        displayName: 'たろちゃん',
      })

      expect(changed.ok).toBe(true)
      expect(Member.byUser(hokkaido.members, taro.id)?.displayName).toBe('たろう')
    })

    it('対象がその Group の Member でなければ失敗する', () => {
      expect(
        Group.changeDisplayName(groupOf(), {
          member: toMemberId('m9'),
          displayName: 'たろちゃん',
        }),
      ).toEqual({ ok: false, error: { kind: 'notMember' } })
    })

    it('表示名の制約は Member を作るときと同じ', () => {
      const group = groupOf()

      expect(
        Group.changeDisplayName(group, { member: toMemberId('m1'), displayName: '  ' }),
      ).toEqual({ ok: false, error: { kind: 'displayNameEmpty' } })
      expect(
        Group.changeDisplayName(group, {
          member: toMemberId('m1'),
          displayName: 'あ'.repeat(21),
        }),
      ).toEqual({ ok: false, error: { kind: 'displayNameTooLong' } })
    })

    it('2 人が同時に変更しても失敗せず、後から届いた方が勝つ', () => {
      const group = groupOf()

      const first = Group.changeDisplayName(group, {
        member: toMemberId('m1'),
        displayName: 'たろちゃん',
      })
      const second = Group.changeDisplayName(group, {
        member: toMemberId('m1'),
        displayName: 'たろさん',
      })

      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      expect(second.ok && Member.byId(second.value.members, toMemberId('m1'))?.displayName).toBe(
        'たろさん',
      )
    })
  })

  describe('起きないこと', () => {
    it('操作しても元の Group は書き換わらない', () => {
      const group = groupOf()

      Group.changeSettings(group, { actor: taro.id, name: '北海道旅行', defaultCurrency: 'USD' })
      Group.join(group, { memberId: toMemberId('m2'), user: jiro, displayName: 'じろう' })
      Group.changeDisplayName(group, { member: toMemberId('m1'), displayName: 'たろちゃん' })

      expect(group).toEqual(groupOf())
    })
  })
})

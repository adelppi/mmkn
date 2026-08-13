import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId, toUserId } from '../id'
import { Member } from './member'

const create = (displayName: string, memberId = 'm1', userId = 'u1') =>
  Member.create({
    id: toMemberId(memberId),
    groupId: toGroupId('g1'),
    userId: toUserId(userId),
    displayName,
  })

const memberOf = (displayName: string, memberId = 'm1', userId = 'u1') => {
  const member = create(displayName, memberId, userId)
  if (!member.ok) throw new Error('前提の Member を作れなかった')
  return member.value
}

describe('Member', () => {
  describe('作る', () => {
    it('User と Group と表示名を持つ', () => {
      expect(create('たろう')).toEqual({
        ok: true,
        value: {
          id: toMemberId('m1'),
          groupId: toGroupId('g1'),
          userId: toUserId('u1'),
          displayName: 'たろう',
        },
      })
    })

    it('表示名の前後の空白は落ちる', () => {
      const member = create('  たろう  ')

      expect(member.ok && member.value.displayName).toBe('たろう')
    })

    it('表示名は空にできない', () => {
      expect(create('  ')).toEqual({ ok: false, error: { kind: 'displayNameEmpty' } })
    })

    it('表示名は 20 文字以内', () => {
      expect(create('あ'.repeat(20)).ok).toBe(true)
      expect(create('あ'.repeat(21))).toEqual({
        ok: false,
        error: { kind: 'displayNameTooLong' },
      })
    })
  })

  describe('表示名を変更する', () => {
    it('表示名だけが変わる', () => {
      const member = memberOf('たろう')

      expect(Member.rename(member, ' じろう ')).toEqual({
        ok: true,
        value: { ...member, displayName: 'じろう' },
      })
    })

    it('制約は作るときと同じ', () => {
      const member = memberOf('たろう')

      expect(Member.rename(member, '')).toEqual({ ok: false, error: { kind: 'displayNameEmpty' } })
      expect(Member.rename(member, 'あ'.repeat(21))).toEqual({
        ok: false,
        error: { kind: 'displayNameTooLong' },
      })
    })

    it('元の Member は変わらない', () => {
      const member = memberOf('たろう')
      Member.rename(member, 'じろう')

      expect(member.displayName).toBe('たろう')
    })
  })

  describe('引く', () => {
    const members = [memberOf('たろう', 'm1', 'u1'), memberOf('じろう', 'm2', 'u2')]

    it('User から引ける', () => {
      expect(Member.byUser(members, toUserId('u2'))?.displayName).toBe('じろう')
    })

    it('参加していない User では引けない', () => {
      expect(Member.byUser(members, toUserId('u3'))).toBeUndefined()
    })

    it('識別子から引ける', () => {
      expect(Member.byId(members, toMemberId('m1'))?.displayName).toBe('たろう')
    })

    it('その Group にいない Member の識別子では引けない', () => {
      expect(Member.byId(members, toMemberId('m3'))).toBeUndefined()
    })

    it('同じ表示名の Member が複数いてもよい', () => {
      const sameName = [memberOf('たろう', 'm1', 'u1'), memberOf('たろう', 'm2', 'u2')]

      expect(Member.byUser(sameName, toUserId('u1'))?.id).toBe(toMemberId('m1'))
      expect(Member.byUser(sameName, toUserId('u2'))?.id).toBe(toMemberId('m2'))
    })
  })
})

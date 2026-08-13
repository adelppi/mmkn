import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId, toUserId } from '../id'
import { requireGroupMember, requireMember } from './access'
import { Member } from './member'

const memberOf = (memberId: string, userId: string) => {
  const member = Member.create({
    id: toMemberId(memberId),
    groupId: toGroupId('g1'),
    userId: toUserId(userId),
    displayName: 'たろう',
  })
  if (!member.ok) throw new Error('前提の Member を作れなかった')
  return member.value
}

const group = { members: [memberOf('m1', 'u1')] }

describe('認可の判定', () => {
  describe('対象が手元にあるとき', () => {
    it('Member ならその Member が返る', () => {
      expect(requireMember(group, toUserId('u1'))).toEqual({ ok: true, value: group.members[0] })
    })

    it('ログインしていなければ、ログインが必要であることを返す', () => {
      expect(requireMember(group, undefined)).toEqual({
        ok: false,
        error: { kind: 'notAuthenticated' },
      })
    })

    it('Member でなければ、Member でないことを返す', () => {
      expect(requireMember(group, toUserId('u2'))).toEqual({
        ok: false,
        error: { kind: 'notMember' },
      })
    })
  })

  describe('対象を解決するところから確かめるとき', () => {
    it('Member ならその Member が返る', () => {
      expect(requireGroupMember(group, toUserId('u1'))).toEqual({
        ok: true,
        value: group.members[0],
      })
    })

    it('対象が存在しなければ、見つからないことを返す', () => {
      expect(requireGroupMember(undefined, toUserId('u1'))).toEqual({
        ok: false,
        error: { kind: 'notFound' },
      })
    })

    it('存在しないことと、Member でないことを区別する', () => {
      const notFound = requireGroupMember(undefined, toUserId('u2'))
      const notMember = requireGroupMember(group, toUserId('u2'))

      expect(notFound.ok).toBe(false)
      expect(notMember.ok).toBe(false)
      expect(notFound).not.toEqual(notMember)
    })

    it('未ログインは、対象の有無に依らずログインが必要であることを返す', () => {
      expect(requireGroupMember(undefined, undefined)).toEqual({
        ok: false,
        error: { kind: 'notAuthenticated' },
      })
      expect(requireGroupMember(group, undefined)).toEqual({
        ok: false,
        error: { kind: 'notAuthenticated' },
      })
    })
  })
})

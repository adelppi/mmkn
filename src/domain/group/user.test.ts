import { describe, expect, it } from 'vitest'
import { toUserId } from '../id'
import { User } from './user'

const create = (name: string) =>
  User.create({ id: toUserId('u1'), name, loginIdentifier: 'auth-1' })

describe('User', () => {
  describe('アカウントを作成する', () => {
    it('名前とログイン識別子を持つ User ができる', () => {
      expect(create('たろう')).toEqual({
        ok: true,
        value: { id: toUserId('u1'), name: 'たろう', loginIdentifier: 'auth-1' },
      })
    })

    it('名前の前後の空白は落ちる', () => {
      const user = create('  たろう  ')

      expect(user.ok && user.value.name).toBe('たろう')
    })

    it('名前は空にできない', () => {
      expect(create('   ')).toEqual({ ok: false, error: { kind: 'nameEmpty' } })
    })

    it('名前は 20 文字以内', () => {
      expect(create('あ'.repeat(20)).ok).toBe(true)
      expect(create('あ'.repeat(21))).toEqual({ ok: false, error: { kind: 'nameTooLong' } })
    })

    it('ログイン識別子はそのまま持つ（名前とは別のもの）', () => {
      const user = create('たろう')

      expect(user.ok && user.value.loginIdentifier).toBe('auth-1')
    })
  })
})

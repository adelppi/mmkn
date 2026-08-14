import { describe, expect, it } from 'vitest'
import { LoginMethod, sameExternalAccount } from './login-method'

const discord = { service: 'discord', id: 'discord-1' }
const google = { service: 'google', id: 'google-1' }

describe('ログイン手段', () => {
  describe('追加してよいか', () => {
    it('1 つも無ければ追加できる', () => {
      expect(LoginMethod.requireAddable([], discord).ok).toBe(true)
    })

    it('サービスが違えば追加できる', () => {
      expect(LoginMethod.requireAddable([google], discord).ok).toBe(true)
    })

    it('同じサービスの別のアカウントは追加できない', () => {
      const result = LoginMethod.requireAddable([discord], {
        service: 'discord',
        id: 'discord-2',
      })

      expect(result).toEqual({ ok: false, error: { kind: 'serviceAlreadyUsed' } })
    })

    it('同じアカウントを追加し直しても失敗しない。繰り返しても結果が変わらない', () => {
      expect(LoginMethod.requireAddable([discord], discord).ok).toBe(true)
    })
  })

  describe('削除してよいか', () => {
    it('2 つ以上あれば削除でき、対象が返る', () => {
      const result = LoginMethod.requireRemovable([google, discord], 'discord')

      expect(result).toEqual({ ok: true, value: discord })
    })

    it('**最後の 1 つは削除できない**', () => {
      const result = LoginMethod.requireRemovable([discord], 'discord')

      expect(result).toEqual({ ok: false, error: { kind: 'lastLoginMethod' } })
    })

    it('そのサービスのログイン手段が無ければ削除できない', () => {
      const result = LoginMethod.requireRemovable([google, discord], 'slack')

      expect(result).toEqual({ ok: false, error: { kind: 'notALoginMethod' } })
    })

    it('1 つも無い状態では、最後の 1 つより先に「無い」が返る', () => {
      const result = LoginMethod.requireRemovable([], 'discord')

      expect(result).toEqual({ ok: false, error: { kind: 'notALoginMethod' } })
    })
  })

  describe('同じアカウントかどうか', () => {
    it('サービスと ID の両方が一致したときだけ同じ', () => {
      expect(sameExternalAccount(discord, { ...discord })).toBe(true)
      expect(sameExternalAccount(discord, { service: 'discord', id: 'discord-2' })).toBe(false)
      expect(sameExternalAccount(discord, { service: 'slack', id: 'discord-1' })).toBe(false)
    })
  })
})

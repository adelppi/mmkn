import { describe, expect, it } from 'vitest'
import { toUserId } from '../../domain/id'
import { taro } from '../fixture'
import { fakeUserRepository } from '../port/fake'
import { logOut } from './log-out'

describe('ログアウトする', () => {
  it('ログインしていれば成功する', async () => {
    const users = fakeUserRepository([taro])

    const result = await logOut({ users })({ actor: taro.id })

    expect(result).toEqual({ ok: true, value: undefined })
  })

  it('User は消えない。ログアウトは退会ではない', async () => {
    const users = fakeUserRepository([taro])

    await logOut({ users })({ actor: taro.id })

    expect(users.stored()).toEqual([taro])
  })

  it('ログインしていなければ失敗する', async () => {
    const users = fakeUserRepository([taro])

    const result = await logOut({ users })({ actor: undefined })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
  })

  it('操作する User が存在しなければ、ログインしていないものとして扱う', async () => {
    const users = fakeUserRepository([taro])

    const result = await logOut({ users })({ actor: toUserId('いない') })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
  })
})

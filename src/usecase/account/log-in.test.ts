import { describe, expect, it } from 'vitest'
import { taro } from '../fixture'
import { fakeUserRepository } from '../port/fake'
import { logIn } from './log-in'

describe('ログインする', () => {
  it('登録済みの識別子なら、その User の操作として扱われる', async () => {
    const users = fakeUserRepository([taro])

    const result = await logIn({ users })({ loginIdentifier: taro.loginIdentifier })

    expect(result.ok && result.value.id).toBe(taro.id)
  })

  it('登録されていない識別子では失敗し、User は作られない', async () => {
    const users = fakeUserRepository([taro])

    const result = await logIn({ users })({ loginIdentifier: 'auth-知らない人' })

    expect(result).toEqual({ ok: false, error: { kind: 'accountNotFound' } })
    expect(users.stored()).toEqual([taro])
  })

  it('引くのは名前ではなくログイン識別子', async () => {
    const users = fakeUserRepository([taro])

    const result = await logIn({ users })({ loginIdentifier: taro.name })

    expect(result).toEqual({ ok: false, error: { kind: 'accountNotFound' } })
  })
})

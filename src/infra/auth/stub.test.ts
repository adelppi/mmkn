import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Cookie, CookieStore } from './client'
import { AUTH_STUB_ENV, authStubEnabled, createStubAuthClient } from './stub'

/**
 * 偽の認証（`stub.ts`）。
 *
 * **最初の 1 群が最も重い。** 偽の認証は本番にも出るコードであり、
 * **既定で切り替わらないことがその安全性のすべてである**（`docs/adr/0010-testing.md`）。
 */

/** 手元だけの cookie。ブラウザの代わりに、書かれたものをそのまま保つ。 */
const cookieStore = (initial: readonly Cookie[] = []): CookieStore => {
  const cookies = new Map(initial.map(({ name, value }) => [name, value]))

  return {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: (list) => {
      for (const { name, value } of list) cookies.set(name, value)
    },
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('切り替わる条件', () => {
  it('環境変数が無ければ切り替わらない', () => {
    vi.stubEnv(AUTH_STUB_ENV, undefined)

    expect(authStubEnabled()).toBe(false)
  })

  it('1 以外の値でも切り替わらない', () => {
    vi.stubEnv(AUTH_STUB_ENV, 'true')

    expect(authStubEnabled()).toBe(false)
  })

  it('1 のときだけ切り替わる', () => {
    vi.stubEnv(AUTH_STUB_ENV, '1')

    expect(authStubEnabled()).toBe(true)
  })
})

describe('ログインの往復', () => {
  it('認可画面の代わりに、戻り先へ code を付けて返す', async () => {
    const client = createStubAuthClient(cookieStore([{ name: 'mmkn-e2e-login-as', value: 'taro' }]))

    const { data } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://127.0.0.1:3000/auth/callback' },
    })

    expect(data.url).toBe('http://127.0.0.1:3000/auth/callback?code=taro')
  })

  it('戻り先が既に問い合わせ文字列を持っていても壊さない', async () => {
    const client = createStubAuthClient(cookieStore([{ name: 'mmkn-e2e-login-as', value: 'taro' }]))

    const { data } = await client.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: 'http://127.0.0.1:3000/auth/callback?add=discord' },
    })

    expect(data.url).toBe('http://127.0.0.1:3000/auth/callback?add=discord&code=taro')
  })

  it('誰としてログインするかが置かれていなければ、サービスごとの既定になる', async () => {
    const client = createStubAuthClient(cookieStore())

    const { data } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: '/auth/callback' },
    })

    expect(data.url).toBe('/auth/callback?code=e2e%3Agoogle')
  })

  it('往復を完了するとログイン識別子が返るようになる', async () => {
    const cookies = cookieStore()
    const client = createStubAuthClient(cookies)

    const completed = await client.auth.exchangeCodeForSession('taro')
    expect(completed.data.user?.id).toBe('taro')
    expect(completed.error).toBeNull()

    // **同じ cookie を読む別の接続でも見える。** リクエストごとに作り直されるため。
    const next = createStubAuthClient(cookies)
    const { data } = await next.auth.getUser()

    expect(data.user?.id).toBe('taro')
  })

  it('ログインしていなければ user は無い', async () => {
    const { data, error } = await createStubAuthClient(cookieStore()).auth.getUser()

    expect(data.user).toBeNull()
    expect(error).toBeNull()
  })

  it('セッションを終わらせると、識別子を返さなくなる', async () => {
    const cookies = cookieStore()
    await createStubAuthClient(cookies).auth.exchangeCodeForSession('taro')

    await createStubAuthClient(cookies).auth.signOut()

    const { data } = await createStubAuthClient(cookies).auth.getUser()
    expect(data.user).toBeNull()
  })
})

describe('扱わないもの', () => {
  it('ログイン手段の追加は、成功したことにせず落ちる', async () => {
    const client = createStubAuthClient(cookieStore())

    await expect(client.auth.linkIdentity({ provider: 'discord' })).rejects.toThrow()
  })
})

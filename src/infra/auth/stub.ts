import type { AuthClient, CookieStore } from './client'

/**
 * E2E だけが使う偽の認証（`docs/adr/0010-testing.md`「E2E が使う認証基盤」）。
 *
 * ```
 * 本物  ブラウザ → 認可画面 → /auth/callback?code=… → セッションの cookie
 * ここ  ブラウザ →   ここ   → /auth/callback?code=… → セッションの cookie
 * ```
 *
 * **`E2E_AUTH_STUB` が `1` のときだけ切り替わる**（`client.ts`・`jwks.ts`）。
 * **この変数をホスティング環境に置かない。** 置くと、任意の識別子でログインできる。
 */

/** ログイン済みであることを表す cookie。**値がそのままログイン識別子になる。** */
export const SESSION_COOKIE = 'mmkn-e2e-session'

/** 次のログインで、誰としてログインするか。**テストが先に置く。** 本物では認可画面で選ぶ部分にあたる。 */
const LOGIN_AS_COOKIE = 'mmkn-e2e-login-as'

/** 偽の認証に切り替える環境変数。**手元と CI だけで立て、ホスティング環境には置かない。** */
export const AUTH_STUB_ENV = 'E2E_AUTH_STUB'

export const authStubEnabled = (): boolean => process.env[AUTH_STUB_ENV] === '1'

const cookieValue = (cookies: CookieStore, name: string): string | undefined => {
  const found = cookies.getAll().find((cookie) => cookie.name === name)
  return found === undefined || found.value === '' ? undefined : found.value
}

const putCookie = (cookies: CookieStore, name: string, value: string): void => {
  cookies.setAll([
    {
      name,
      value,
      options: { path: '/', httpOnly: true, sameSite: 'lax', maxAge: value === '' ? 0 : 3600 },
    },
  ])
}

/** 認可画面の代わりに返す行き先。**そのまま戻り先へ送り返す。** */
const callbackWith = (redirectTo: string, code: string): string =>
  `${redirectTo}?code=${encodeURIComponent(code)}`

/** 偽の認証への接続。使われる分だけを、本物と同じ形で返す。 */
export const createStubAuthClient = (cookies: CookieStore): AuthClient => {
  const auth = {
    /** **本物では署名の検証にあたる。** ここでは cookie の値をそのまま識別子として返す。 */
    getClaims: async () => {
      const loginIdentifier = cookieValue(cookies, SESSION_COOKIE)
      if (loginIdentifier === undefined) return { data: null, error: null }

      return { data: { claims: { sub: loginIdentifier } }, error: null }
    },

    /** **入口が更新を起こすために呼ぶ**（`proxy.ts`）。偽のトークンは期限切れにならない。 */
    getSession: async () => {
      const loginIdentifier = cookieValue(cookies, SESSION_COOKIE)
      if (loginIdentifier === undefined) return { data: { session: null }, error: null }

      return {
        data: {
          session: {
            access_token: loginIdentifier,
            user: { id: loginIdentifier },
          },
        },
        error: null,
      }
    },

    /** 認可画面へ送り出す代わりに、戻り先をそのまま返す。 */
    signInWithOAuth: async (input: { provider: string; options?: { redirectTo?: string } }) => {
      const redirectTo = input.options?.redirectTo ?? '/auth/callback'
      const loginIdentifier = cookieValue(cookies, LOGIN_AS_COOKIE) ?? `e2e:${input.provider}`

      return { data: { url: callbackWith(redirectTo, loginIdentifier) }, error: null }
    },

    exchangeCodeForSession: async (code: string) => {
      putCookie(cookies, SESSION_COOKIE, code)

      return {
        data: { user: { id: code } },
        error: null,
      }
    },

    signOut: async () => {
      putCookie(cookies, SESSION_COOKIE, '')
      return { error: null }
    },
  }

  return { auth } as unknown as AuthClient
}

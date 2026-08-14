import type { AuthClient, CookieStore } from './client'

/**
 * E2E だけが使う偽の認証（`docs/adr/0010-testing.md`「E2E が使う認証基盤」）。
 *
 * **本物の認証基盤には繋がない。** CI 内でアプリを起動する以上アプリは認証基盤に繋がるが、
 * 本番に向ければ E2E が本物のアカウントを作る。使い捨ての認証基盤も、認可画面をまたぐ自動化も
 * 持たないと決めた（`docs/adr/0010`）ため、**ログイン済みの状態を偽の認証で作る。**
 *
 * ```
 * ログインの往復（本物）  ブラウザ → 認可画面 → /auth/callback?code=… → セッションの cookie
 * ログインの往復（ここ）  ブラウザ →   ここ   → /auth/callback?code=… → セッションの cookie
 * ```
 *
 * **外部サービスの認可画面の代わりをするだけで、それ以外の経路は本物と同じものが動く。**
 * 画面もユースケースも永続化も差し替えない。
 *
 * ## 何を確かめられなくなるか
 *
 * **本物の認証基盤の挙動は、E2E では何一つ確かめられない**（同じ外部アカウントで再ログインした
 * ときに同じ user が返るか、ログイン手段の追加が成立するか）。それらは
 * `docs/operations.md`「実装着手時に必ず確かめること」の手動確認が正であり、ここは代わりにならない。
 *
 * ## 有効になる条件
 *
 * **`E2E_AUTH_STUB` が `1` のときだけ切り替わる**（`src/infra/auth/client.ts`）。
 * **この変数をホスティング環境に置かない**（`docs/operations.md`「環境変数」）。置いた時点で、
 * 本物のログインを通らずに任意の識別子でログインできる状態になる。
 */

/** ログイン済みであることを表す cookie。**値がそのままログイン識別子になる。** */
const SESSION_COOKIE = 'mmkn-e2e-session'

/**
 * 次のログインで、誰としてログインするか。**テストが先に置く。**
 *
 * 本物では認可画面で選ぶ部分にあたる。ブラウザの文脈ごとに別の値を置くことで、
 * 1 つの E2E の中で複数の利用者を扱える（グループを作る人と、参加する人）。
 */
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

/** その識別子のログイン手段。**1 つだけ持つ。** */
const identitiesOf = (loginIdentifier: string) => [
  { provider: 'google', id: `google:${loginIdentifier}` },
]

/**
 * 認可画面の代わりに返す行き先。**そのまま戻り先へ送り返す。**
 *
 * 戻り先は往復の種類で決まる（ログインは印なし、ログイン手段の追加は `?add=…`。
 * `app/auth/callback/route.ts`）ため、既にある問い合わせ文字列を壊さずに `code` を足す。
 */
const callbackWith = (redirectTo: string, code: string): string =>
  `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}`

/**
 * 偽の認証への接続。
 *
 * **本物と同じ形の値を返す**（`src/infra/auth/session.ts` と `external-account.ts` が読む形）。
 * 型は認証基盤の SDK のものであり、そのすべてを持たないため、使われる分だけを作って変換する。
 */
export const createStubAuthClient = (cookies: CookieStore): AuthClient => {
  const auth = {
    getUser: async () => {
      const loginIdentifier = cookieValue(cookies, SESSION_COOKIE)
      if (loginIdentifier === undefined) return { data: { user: null }, error: null }

      return {
        data: { user: { id: loginIdentifier, identities: identitiesOf(loginIdentifier) } },
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
        data: { user: { id: code, identities: identitiesOf(code) } },
        error: null,
      }
    },

    signOut: async () => {
      putCookie(cookies, SESSION_COOKIE, '')
      return { error: null }
    },

    getUserIdentities: async () => {
      const loginIdentifier = cookieValue(cookies, SESSION_COOKIE)

      return {
        data: { identities: loginIdentifier === undefined ? [] : identitiesOf(loginIdentifier) },
        error: null,
      }
    },

    /**
     * **扱わない。** ログイン手段の追加と削除は認可画面をまたぐ往復であり、
     * それを自動化しないと決めている（`docs/adr/0010`「E2E の範囲」）。
     *
     * **握りつぶさない。** 何事も無かったように振る舞うと、E2E が「追加できた」と誤って通る。
     */
    linkIdentity: async () => {
      throw new Error('E2E の偽の認証は、ログイン手段の追加を扱わない')
    },
    unlinkIdentity: async () => {
      throw new Error('E2E の偽の認証は、ログイン手段の削除を扱わない')
    },
  }

  return { auth } as unknown as AuthClient
}

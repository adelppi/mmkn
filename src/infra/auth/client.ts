import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authStubEnabled, createStubAuthClient, SESSION_COOKIE } from './stub'

/**
 * 認証基盤への接続（`docs/adr/0012-login.md`）。**データアクセスには使わない**（`docs/adr/0005`）。
 *
 * cookie へのアクセス手段はアプリ層から注入する（`docs/adr/0008`「セッションの読み取り」）。
 */

export type Cookie = { readonly name: string; readonly value: string }

/**
 * cookie の読み書き手段。`app/_lib/session.ts` が実体を渡す。
 *
 * **`setAll` が呼べる文脈は限られる。** Server Component からは書けない。
 */
export type CookieStore = {
  readonly getAll: () => Cookie[]
  readonly setAll: (cookies: readonly (Cookie & { options: CookieOptions })[]) => void
}

export type AuthClient = SupabaseClient

/** **無ければ落とす。** 設定されていないまま繋ぎに行っても、失敗の理由が分からなくなる。 */
export const requiredEnv = (name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string => {
  const value = process.env[name]
  if (value === undefined || value === '') throw new Error(`${name} が設定されていない`)
  return value
}

/**
 * リクエストごとに作る。**モジュールスコープに持たない**（cookie を通じて 1 人の利用者に結びつくため）。
 *
 * **偽の認証に切り替わる口がここにある**（`stub.ts`）。切り替わるのは `E2E_AUTH_STUB` が
 * 立っているときだけで、既定は本物である。もう 1 か所の分岐は `jwks.ts` にある。
 */
export const createAuthClient = (cookies: CookieStore): AuthClient =>
  authStubEnabled()
    ? createStubAuthClient(cookies)
    : createServerClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
        cookies: {
          getAll: () => cookies.getAll(),
          setAll: (cookiesToSet) => cookies.setAll(cookiesToSet),
        },
      })

/** セッションの cookie を持っているか。**中身は見ず、認可の判定もしない。** */
export const hasSessionCookie = (cookies: CookieStore): boolean =>
  cookies
    .getAll()
    .some(({ name, value }) =>
      value === '' ? false : authStubEnabled() ? name === SESSION_COOKIE : name.startsWith('sb-'),
    )

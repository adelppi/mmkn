import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authStubEnabled, createStubAuthClient, SESSION_COOKIE } from './stub'

/**
 * 認証基盤への接続（`docs/adr/0003-tech-stack.md`「認証」・`docs/adr/0012-login.md`）。
 *
 * **データアクセスには使わない。** データは `DATABASE_URL` + ORM で読み書きする
 * （`docs/adr/0005-data-access-and-authorization.md`）。ここが担うのは認証とセッションだけ。
 *
 * **cookie へのアクセス手段はアプリ層から注入する**（`docs/adr/0008-layer-internals.md`
 * 「セッションの読み取り」）。cookie の読み取りはフレームワークに依存するため、
 * ここで `next/headers` を呼ぶと依存方向の検査（インフラ層は `next/*` を使わない）に触れる。
 */

export type Cookie = { readonly name: string; readonly value: string }

/**
 * cookie の読み書き手段。`app/_lib/session.ts` が実体を渡す。
 *
 * **`setAll` が呼べる文脈は限られる。** Server Action と Route Handler では書けるが、
 * Server Component からは書けない。どちらを渡すかはアプリ層が判断する。
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
 * リクエストごとに作る。**モジュールスコープに持たない**（cookie を通じて 1 人の利用者に
 * 結びつくため、リクエストをまたいで意味を持つ状態になる。`docs/adr/0003`）。
 *
 * **偽の認証に切り替わる口がここにある**（`stub.ts`）。**アプリ層には分岐が要らない**
 * （`app/_lib/session.ts`・`app/api/discord/route.ts`・`proxy.ts` は変わらない）。
 * **切り替わるのは `E2E_AUTH_STUB` が立っているときだけで、既定は本物である。**
 *
 * **分岐は `infra/auth` の中に 2 つある。** 接続（ここ）と、署名を検証する公開鍵（`jwks.ts`）。
 * 偽の認証は署名を持たないため、鍵の配布先も持たない。
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

/**
 * セッションの cookie を持っているか。**中身は見ない。**
 *
 * **これは認可の判定ではない。** 判定はドメイン層にあり、そこへ至る経路はユースケースだけである
 * （`docs/adr/0005-data-access-and-authorization.md`）。ここが答えるのは
 * 「更新するものがあるか」だけで、通す・通さないは決めない（`proxy.ts`）。
 *
 * **cookie の名前を知っているのはこの層だけである。** 認証基盤ごとに違うため、
 * アプリ層に書くと基盤を替えたときに 2 か所を直すことになる。
 */
export const hasSessionCookie = (cookies: CookieStore): boolean =>
  cookies
    .getAll()
    .some(({ name, value }) =>
      value === '' ? false : authStubEnabled() ? name === SESSION_COOKIE : name.startsWith('sb-'),
    )

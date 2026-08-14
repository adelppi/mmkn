import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

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

const required = (name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string => {
  const value = process.env[name]
  if (value === undefined || value === '') throw new Error(`${name} が設定されていない`)
  return value
}

/**
 * リクエストごとに作る。**モジュールスコープに持たない**（cookie を通じて 1 人の利用者に
 * 結びつくため、リクエストをまたいで意味を持つ状態になる。`docs/adr/0003`）。
 */
export const createAuthClient = (cookies: CookieStore): AuthClient =>
  createServerClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (cookiesToSet) => cookies.setAll(cookiesToSet),
    },
  })

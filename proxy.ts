import { createAuthClient, hasSessionCookie, type CookieStore } from '@/src/infra/auth/client'
import { refreshSession } from '@/src/infra/auth/session'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * セッションのトークンを更新し、cookie に書き戻す
 * （`docs/adr/0008-layer-internals.md`「セッションの読み取り」「どのリクエストで更新するか」）。
 *
 * **Server Component は cookie を書けないため、更新できる場所はここだけである。**
 * **認可は判定しない。** 画面の先読みは実際の遷移と見分けられないため、素通ししない。
 *
 * ファイル名が `middleware` ではなく `proxy` なのは、Next.js 16 で前者が非推奨になったため。
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  const cookies: CookieStore = {
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (list) => {
      for (const { name, value, options } of list) response.cookies.set(name, value, options)
    },
  }

  // **セッションを持たない人は更新するものを持たない。** ログイン前の画面まで
  // 認証基盤への往復を挟むと、何も起きない待ち時間だけが増える。
  if (!hasSessionCookie(cookies)) return response

  // **更新を起こして書き戻すためだけに呼ぶ。** 誰であるかはここでは要らない。
  // 識別子を得る側は署名の検証で済ませ、認証基盤に出ない（`docs/adr/0008`「セッションの検証」）。
  // **その分、期限切れを更新できる場所はここだけになる。**
  await refreshSession(createAuthClient(cookies))

  return response
}

export const config = {
  /**
   * 通さないもの。
   *
   * - 静的ファイル・Next.js の内部 … セッションを持たないため、更新するものが無い
   * - `auth/` … ログインの往復の戻り先。**そこは Route Handler が自分で cookie を書ける**
   */
  matcher: [
    '/((?!auth/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

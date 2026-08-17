import { createAuthClient, hasSessionCookie, type CookieStore } from '@/src/infra/auth/client'
import { refreshSession } from '@/src/infra/auth/session'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * セッションのトークンを更新し、cookie に書き戻す
 * （`docs/adr/0008-layer-internals.md`「セッションの読み取り」）。
 *
 * **これが要るのは、Server Component が cookie を書けないためである。** 期限切れのトークンを
 * 更新できるのは認証基盤の SDK だが、その結果を Server Component からは保存できない。
 * 保存できないまま古いトークンを使い続けると、**利用者から見ると勝手にログアウトされる。**
 *
 * **ここは認可を判定しない。** 判定はドメイン層にあり（`docs/adr/0005`）、そこへ至る経路は
 * ユースケースだけである。ここが持つのはトークンの更新だけで、通す・通さないは決めない。
 *
 * **更新するものが無いリクエストでは、認証基盤に問い合わせない**（同「どのリクエストで更新するか」）。
 * 素通しする 2 つは、どちらも「保存すべき新しいトークンが生まれない」ことが理由である。
 *
 * ファイル名が `middleware` ではなく `proxy` なのは、Next.js 16 で前者が非推奨になったため。
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  // **先読みでは更新しない。** 画面を先に取りにいくだけの往復であり、そこで新しいトークンを
  // 発行しても、利用者の手元に残る保証がない（応答の cookie が使われるとは限らない）。
  // 実際の遷移と操作は先読みではないため、更新の機会はそちらで訪れる。
  if (request.headers.get('next-router-prefetch') !== null) return response

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
   * - `api/` … Discord の署名付きエンドポイント（`docs/adr/0006`）。cookie を持たない
   * - `auth/` … ログインの往復の戻り先。**そこは Route Handler が自分で cookie を書ける**
   */
  matcher: [
    '/((?!api/|auth/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

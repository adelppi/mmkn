import { createAuthClient } from '@/src/infra/auth/client'
import { currentLoginIdentifier } from '@/src/infra/auth/session'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * セッションのトークンを更新し、cookie に書き戻す
 * （`docs/adr/0008-layer-internals.md`「セッションの読み取り」）。
 *
 * **これが要るのは、Server Component が cookie を書けないためである。** 期限切れのトークンは
 * 認証基盤の SDK が問い合わせのついでに更新するが、その結果を Server Component からは保存できない。
 * 保存できないまま古いトークンを使い続けると、**利用者から見ると勝手にログアウトされる。**
 *
 * **ここは認可を判定しない。** 判定はドメイン層にあり（`docs/adr/0005`）、そこへ至る経路は
 * ユースケースだけである。ここが持つのはトークンの更新だけで、通す・通さないは決めない。
 *
 * ファイル名が `middleware` ではなく `proxy` なのは、Next.js 16 で前者が非推奨になったため。
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  const client = createAuthClient({
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (list) => {
      for (const { name, value, options } of list) response.cookies.set(name, value, options)
    },
  })

  // 値を使うためではなく、**更新を起こして書き戻すために呼ぶ。**
  await currentLoginIdentifier(client)

  return response
}

export const config = {
  /** 静的ファイルは通さない（セッションを持たないため、更新するものが無い）。 */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

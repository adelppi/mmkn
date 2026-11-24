import { authClient } from '@/app/_lib/session'
import { wire } from '@/app/_lib/wire'
import { route } from '@/src/adapter/web/presenter/route'
import { completeLogin } from '@/src/infra/auth/session'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 認可画面から戻ってくる先（`docs/adr/0012-login.md`）。
 *
 * **ここは往復の完了と、対応するユースケースの呼び出しだけを行う。**
 * 結果をどう見せるかは Web の画面が持つ（`docs/adr/0009-web-ui.md` の Presenter）。
 * ここが決めるのは行き先だけで、文言は持たない。
 *
 * **`/auth/callback` は fetch の口ではなく、外部サービスからのリダイレクト先である。**
 * `docs/adr/0003-tech-stack.md` が Web の操作の経路を Server Actions に絞っていることとは衝突しない。
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin))

  const code = url.searchParams.get('code')
  if (code === null) return to(route.login())

  const client = await authClient()

  const completed = await completeLogin(client, code)
  if (completed.kind === 'rejected') return to(route.login())

  // ログイン（`docs/domain/group.md`「ログインする」）。
  // **User は作られない。** その人の User がまだいなければ、アカウントの作成へ導く。
  const usecases = wire({ correlationId: crypto.randomUUID() })
  const result = await usecases.logIn({ loginIdentifier: completed.loginIdentifier })

  return to(result.ok ? route.groups() : route.signUp())
}

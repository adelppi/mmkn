import { authClient, currentUserId } from '@/app/_lib/session'
import { wire } from '@/app/_lib/wire'
import { abandonAddingLoginMethod } from '@/src/infra/auth/external-account'
import { completeOAuth } from '@/src/infra/auth/session'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 認可画面から戻ってくる先（`docs/adr/0012-login.md`）。
 *
 * **ログインと、ログイン手段の追加の両方がここに戻る。** どちらの往復かは、
 * 開始側が `redirectTo` に付けた印で決まる。
 *
 * ```
 * ログイン:         認可画面 → /auth/callback?code=…
 * ログイン手段の追加: 認可画面 → /auth/callback?add=discord&code=…
 * ```
 *
 * **ここは往復の完了と、対応するユースケースの呼び出しだけを行う。**
 * 結果をどう見せるかは Web の画面が持つ（`docs/adr/0009-web-ui.md` の Presenter）。
 * この時点では画面がまだ無いため、結果のタグをそのまま次の場所へ渡している。
 *
 * **`/auth/callback` は fetch の口ではなく、外部サービスからのリダイレクト先である。**
 * `docs/adr/0003-tech-stack.md` が Web の操作の経路を Server Actions に絞っていることとは衝突しない。
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const back = (result: string) => NextResponse.redirect(new URL(`/?auth=${result}`, url.origin))

  const code = url.searchParams.get('code')
  if (code === null) return back('missingCode')

  const client = await authClient()

  const completed = await completeOAuth(client, code)
  // 認証基盤が往復を受け付けなかった。**追加しようとした外部アカウントが既に別の User のもので
  // あるときも、ここで断られる**（`docs/adr/0012`）。データは何も変わっていない。
  if (completed.kind === 'rejected') return back(completed.code ?? 'rejected')

  const usecases = wire({ correlationId: crypto.randomUUID(), client: 'web' }, client)

  const addedService = url.searchParams.get('add')
  if (addedService === null) {
    // ログイン（`docs/domain/group.md`「ログインする」）。
    // **User は作られない。** その人の User がまだいなければ、アカウントの作成へ導く。
    const result = await usecases.logIn({ loginIdentifier: completed.loginIdentifier })
    return back(result.ok ? 'loggedIn' : result.error.kind)
  }

  // ログイン手段の追加（`docs/domain/group.md`「ログイン手段を追加する」）。
  const account = completed.loginMethods.find((method) => method.service === addedService)
  if (account === undefined) return back('rejected')

  const result = await usecases.addLoginMethod({ actor: await currentUserId(client), account })

  // **認められなかった追加を認証基盤に残さない。** identity は往復の完了と同時に作られるため、
  // 断ったのに残すと「失敗した操作が一部だけ適用された」状態になる（`docs/domain/group.md`）。
  if (!result.ok) await abandonAddingLoginMethod(client, account)

  return back(result.ok ? 'added' : result.error.kind)
}

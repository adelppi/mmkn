import { authClient, currentUserId } from '@/app/_lib/session'
import { wire } from '@/app/_lib/wire'
import { abandonLinking } from '@/src/infra/auth/external-account'
import { completeOAuth } from '@/src/infra/auth/session'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 認可画面から戻ってくる先（`docs/adr/0012-login.md`・`docs/adr/0007-external-account-linking.md`）。
 *
 * **ログインと連携の両方がここに戻る。** どちらの往復かは、開始側が `redirectTo` に付けた印で決まる。
 *
 * ```
 * ログイン: Google の認可画面 → /auth/callback?code=…
 * 連携:     Discord の認可画面 → /auth/callback?flow=link&service=discord&code=…
 * ```
 *
 * **ここは往復の完了と、対応するユースケースの呼び出しだけを行う。**
 * 結果をどう見せるかは Web の画面が持つ（`docs/adr/0009-web-ui.md` の Presenter）。
 * この時点では画面がまだ無いため、結果のタグをそのまま次の場所へ渡している。
 *
 * **`/auth/callback` は fetch の口ではなく、外部サービスからのリダイレクト先である。**
 * `docs/adr/0003-tech-stack.md` が Web の操作の経路を Server Actions に絞っていることとは衝突しない。
 */

/** 連携の往復であることを表す印。 */
const LINK_FLOW = 'link'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const back = (result: string) => NextResponse.redirect(new URL(`/?auth=${result}`, url.origin))

  const code = url.searchParams.get('code')
  if (code === null) return back('missingCode')

  const client = await authClient()

  const completed = await completeOAuth(client, code)
  // 認証基盤が往復を受け付けなかった。**連携先が既に別の User のときもここで断られる**
  // （`docs/adr/0007`）。データは何も変わっていない。
  if (completed.kind === 'rejected') return back(completed.code ?? 'rejected')

  const usecases = wire({ correlationId: crypto.randomUUID(), client: 'web' }, client)

  if (url.searchParams.get('flow') !== LINK_FLOW) {
    // ログイン（`docs/domain/group.md`「ログインする」）。
    // **User は作られない。** 登録されていない識別子なら、アカウントの作成へ導く。
    if (completed.loginIdentifier === undefined) return back('rejected')

    const result = await usecases.logIn({ loginIdentifier: completed.loginIdentifier })
    return back(result.ok ? 'loggedIn' : result.error.kind)
  }

  // 連携（`docs/domain/group.md`「外部アカウントを連携する」）。
  const service = url.searchParams.get('service')
  const account = completed.linked.find((linked) => linked.service === service)
  if (account === undefined) return back('rejected')

  const result = await usecases.linkExternalAccount({
    actor: await currentUserId(client),
    account,
  })

  // **認められなかった連携を認証基盤に残さない。** identity は往復の完了と同時に作られるため、
  // 断ったのに残すと「失敗した操作が一部だけ適用された」状態になる（`docs/domain/group.md`）。
  if (!result.ok) await abandonLinking(client, account)

  return back(result.ok ? 'linked' : result.error.kind)
}

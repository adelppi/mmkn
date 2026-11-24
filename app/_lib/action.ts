import { authClient, currentUserId } from '@/app/_lib/session'
import { wire } from '@/app/_lib/wire'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Server Action の下ごしらえ。cookie を書ける接続を作る（読み取り専用の経路は `app/_lib/read.ts`）。
 *
 * **ここでは取得を束ねない**（`docs/adr/0009-web-ui.md`「束ねるのは読み取りだけの経路に限る」）。
 * 束ねると、同じ記録に同時に手が入ったことの検出が**失敗しないまま**成立しなくなる。
 */
export const scope = async () => {
  const client = await authClient()
  const usecases = wire({ correlationId: crypto.randomUUID() })

  return { client, usecases, actor: await currentUserId(client) }
}

/**
 * **手元にあるものをすべて捨てさせる**（`docs/adr/0009-web-ui.md`「直前に見たものを取り直さない」）。
 *
 * 直に呼ぶのは、ビューモデルを返さずに終わる操作だけである。それ以外は下の 2 つを通る。
 */
export const discard = () => revalidatePath('/', 'layout')

/** ビューモデルが次の場所を指していれば、そこへ送り出す。 */
export const navigate = <V extends object>(view: V): V => {
  if ('redirectTo' in view && typeof view.redirectTo === 'string') {
    discard()
    redirect(view.redirectTo)
  }

  return view
}

/** その場に留まる操作のあと、表示を取り直させる。 */
export const refresh = <V>(view: V): V => {
  discard()
  return view
}

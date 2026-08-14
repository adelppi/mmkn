import { authClient, currentUserId } from '@/app/_lib/session'
import { wire } from '@/app/_lib/wire'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Server Action の下ごしらえ（`docs/adr/0003-tech-stack.md`：Web の操作の経路は Server Actions）。
 *
 * **セッションを変える操作も、変えない操作も、ここで cookie を書ける接続を作る**
 * （`docs/adr/0008-layer-internals.md`「セッションの読み取り」）。読み取り専用の経路は
 * `app/_lib/read.ts` にあり、そちらは cookie を書けない。
 */
export const scope = async () => {
  const client = await authClient()
  const usecases = wire({ correlationId: crypto.randomUUID(), client: 'web' }, client)

  return { client, usecases, actor: await currentUserId(client) }
}

/**
 * ビューモデルが次の場所を指していれば、そこへ送り出す。
 *
 * **成功と失敗で分岐しない。** どのビューモデルも同じ 1 行を通り、行き先を持つものだけが動く
 * （`docs/adr/0009-web-ui.md`「失敗の描画」）。
 */
export const navigate = <V extends object>(view: V): V => {
  if ('redirectTo' in view && typeof view.redirectTo === 'string') {
    revalidatePath('/', 'layout')
    redirect(view.redirectTo)
  }

  return view
}

/** その場に留まる操作のあと、表示を取り直させる。 */
export const refresh = <V>(view: V, path: string): V => {
  revalidatePath(path)
  return view
}

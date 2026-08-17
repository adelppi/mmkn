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
 *
 * **ここでは取得を束ねない**（`docs/adr/0009-web-ui.md`「束ねるのは読み取りだけの経路に限る」）。
 * `wire()` を合図なしで呼ぶのがそれで、既定が束ねない側になっている。束ねると書き込み直前の
 * 読み直しが古い値を返し、同じ記録に同時に手が入ったことの検出が**失敗しないまま**成立しなくなる
 * （`docs/domain/record.md`「同じ記録に同時に手が入ったとき」）。
 */
export const scope = async () => {
  const client = await authClient()
  const usecases = wire({ correlationId: crypto.randomUUID(), client: 'web' }, client)

  return { client, usecases, actor: await currentUserId(client) }
}

/**
 * **手元にあるものをすべて捨てさせる**（`docs/adr/0009-web-ui.md`「直前に見たものを取り直さない」）。
 *
 * 画面を移動したとき、直前に見たものは 30 秒だけ再利用される（`next.config.ts`）。**操作の
 * あとにそれが残ると、変えた本人にだけ古い表示が見える。**
 *
 * **捨てる範囲を絞らない。** 1 つの記録を変えると、記録の一覧も、収支も、清算案も同時に変わる。
 * どれが変わったかを数え上げる形にすると、**数え漏らしたものが古いまま残り、しかも失敗しない。**
 *
 * ビューモデルを返す操作は下の 2 つを通るため、直に呼ぶのは**ログアウトのように、ビューモデルを
 * 返さずに終わる操作**だけである。
 */
export const discard = () => revalidatePath('/', 'layout')

/**
 * ビューモデルが次の場所を指していれば、そこへ送り出す。
 *
 * **成功と失敗で分岐しない。** どのビューモデルも同じ 1 行を通り、行き先を持つものだけが動く
 * （`docs/adr/0009-web-ui.md`「失敗の描画」）。
 */
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

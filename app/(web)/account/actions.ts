'use server'

import { refresh, scope } from '@/app/_lib/action'
import { removeLoginMethod } from '@/src/adapter/web/controller/account'
import type { RemoveLoginMethodView } from '@/src/adapter/web/presenter/account'
import { route } from '@/src/adapter/web/presenter/route'
import { endSession } from '@/src/infra/auth/session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * ログイン手段を削除する（`docs/domain/group.md`「ログイン手段を削除する」）。
 *
 * **成功しても他の画面へ送り出さない。** 削除の結果はこの画面で伝わればよく、
 * Group・Member・記録は何も変わらない。
 */
export async function removeLoginMethodAction(previous: RemoveLoginMethodView, data: FormData) {
  const { usecases, actor } = await scope()

  const view = await removeLoginMethod({
    removeLoginMethod: usecases.removeLoginMethod,
    actor,
  })(previous, data)

  return refresh(view, route.account())
}

/**
 * ログアウトする（`docs/domain/group.md`「ログアウトする」・`docs/features.md` #11）。
 *
 * **退会ではない。** User も、Group・Member・記録も、ログイン手段も何一つ変わらない
 * （`docs/features.md`「mmkn が持たないもの」）。
 *
 * 前提条件（ログインしていること）の判定はユースケースが持ち、**セッションを終わらせるのは
 * それが通ったあと**である（`src/usecase/account/log-out.ts`）。
 */
export async function logOutAction() {
  const { client, usecases, actor } = await scope()

  const result = await usecases.logOut({ actor })
  if (result.ok) await endSession(client)

  revalidatePath('/', 'layout')
  redirect(route.login())
}

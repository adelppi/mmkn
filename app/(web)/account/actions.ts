'use server'

import { discard, scope } from '@/app/_lib/action'
import { route } from '@/src/adapter/web/presenter/route'
import { endSession } from '@/src/infra/auth/session'
import { redirect } from 'next/navigation'

/**
 * ログアウトする（`docs/domain/group.md`「ログアウトする」）。
 *
 * **手元にあるものを捨てさせる**（`docs/adr/0009-web-ui.md`「直前に見たものを取り直さない」）。
 * 残すと、**共有の端末で前の利用者の画面が次の人に見える。**
 */
export async function logOutAction() {
  const { client, usecases, actor } = await scope()

  const result = await usecases.logOut({ actor })
  if (result.ok) await endSession(client)

  discard()
  redirect(route.login())
}

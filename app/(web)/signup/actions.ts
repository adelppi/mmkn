'use server'

import { navigate, scope } from '@/app/_lib/action'
import { createAccount } from '@/src/adapter/web/controller/account'
import type { CreateAccountView } from '@/src/adapter/web/presenter/account'
import { currentLoginIdentifier } from '@/src/infra/auth/session'

/**
 * アカウントを作成する（`docs/domain/group.md`「アカウントを作成する」）。
 *
 * **ログイン識別子はセッションから取る。** 本人であることは往復で確かめ済みで、
 * まだ mmkn の User が無い状態でここへ来る（`app/auth/callback/route.ts`）。
 */
export async function createAccountAction(previous: CreateAccountView, data: FormData) {
  const { client, usecases } = await scope()

  const view = await createAccount({
    createAccount: usecases.createAccount,
    loginIdentifier: await currentLoginIdentifier(client),
  })(previous, data)

  return navigate(view)
}

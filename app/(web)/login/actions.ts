'use server'

import { scope } from '@/app/_lib/action'
import { rememberInvite } from '@/app/_lib/invite'
import { optionalField } from '@/src/adapter/web/presenter/form'
import { startLogin } from '@/src/infra/auth/session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/** 認可画面への往復を始める（`docs/adr/0012-login.md`）。 */

const callbackUrl = async (): Promise<string> => {
  const list = await headers()
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? ''
  const protocol = list.get('x-forwarded-proto') ?? 'http'

  return `${protocol}://${host}/auth/callback`
}

/** ログインを始める。**User は作られない**（`docs/domain/group.md`「ログインする」）。 */
export async function startLoginAction(data: FormData) {
  await rememberInvite(optionalField(data, 'inviteCode'))

  const { client } = await scope()
  const url = await startLogin(client, await callbackUrl())

  redirect(url)
}

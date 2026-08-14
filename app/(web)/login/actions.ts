'use server'

import { scope } from '@/app/_lib/action'
import { isLoginService } from '@/app/_lib/login-services'
import { startAddingLoginMethod } from '@/src/infra/auth/external-account'
import { startLogin } from '@/src/infra/auth/session'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * 認可画面への往復を始める（`docs/adr/0012-login.md`）。
 *
 * **Web の経路は Server Actions**（`docs/adr/0003-tech-stack.md`）。往復のために
 * API Routes を新しく作らない。戻ってくる先だけが Route Handler（`app/auth/callback/route.ts`）で、
 * それは外部サービスからのリダイレクト先であって、こちらから叩く口ではない。
 */

const callbackUrl = async (query = ''): Promise<string> => {
  const list = await headers()
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? ''
  const protocol = list.get('x-forwarded-proto') ?? 'http'

  return `${protocol}://${host}/auth/callback${query}`
}

/** ログインを始める。**User は作られない**（`docs/domain/group.md`「ログインする」）。 */
export async function startLoginAction(service: string) {
  if (!isLoginService(service)) redirect('/login')

  const { client } = await scope()
  const url = await startLogin(client, service, await callbackUrl())

  redirect(url)
}

/**
 * ログイン手段の追加を始める。
 *
 * **必ず本人の明示的な操作から始まる**（`docs/adr/0012`「自動統合に頼らない」）。
 * 戻り先に印を付けておき、完了の側でどちらの往復かを判別する。
 */
export async function startAddingLoginMethodAction(service: string) {
  if (!isLoginService(service)) redirect('/account')

  const { client } = await scope()
  const url = await startAddingLoginMethod(
    client,
    service,
    await callbackUrl(`?add=${encodeURIComponent(service)}`),
  )

  redirect(url)
}

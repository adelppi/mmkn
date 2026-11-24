import { rememberedInvite } from '@/app/_lib/invite'
import { authClient } from '@/app/_lib/session'
import { wire } from '@/app/_lib/wire'
import { route } from '@/src/adapter/web/presenter/route'
import { completeLogin, loginReturn } from '@/src/infra/auth/session'
import { NextResponse, type NextRequest } from 'next/server'

/** 認可画面から戻ってくる先（`docs/adr/0012-login.md`）。**決めるのは行き先だけで、文言は持たない。** */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin))

  const inviteCode = await rememberedInvite()

  const returned = loginReturn(url.searchParams)
  if (returned.kind === 'denied') return to(route.login({ inviteCode, failure: 'loginDenied' }))
  if (returned.kind === 'failed') return to(route.login({ inviteCode, failure: 'loginFailed' }))

  const client = await authClient()

  const completed = await completeLogin(client, returned.code)
  if (completed.kind === 'rejected') return to(route.login({ inviteCode, failure: 'loginFailed' }))

  // ログイン（`docs/domain/group.md`「ログインする」）。
  // **User は作られない。** その人の User がまだいなければ、アカウントの作成へ導く。
  const usecases = wire({ correlationId: crypto.randomUUID() })
  const result = await usecases.logIn({ loginIdentifier: completed.loginIdentifier })

  return to(result.ok ? route.entrance(inviteCode) : route.signUp(inviteCode))
}

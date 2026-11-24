import { cookies } from 'next/headers'

/**
 * 認可画面をまたいで、開いていた招待を覚えておく（`docs/adr/0012-login.md`「招待への戻り方」）。
 *
 * **覚えるのは参加コードだけで、行き先は覚えない。**
 */

const INVITE_COOKIE = 'mmkn-invite'

/** 読むのは戻り先だけ（`app/auth/callback/route.ts`）。 */
const PATH = '/auth/callback'

/** 認可画面から戻るまでの時間。 */
const MAX_AGE_SECONDS = 10 * 60

/**
 * ログインを始めるたびに呼ぶ。**招待からでなければ忘れる。**
 * 前に始めたまま終わらなかったログインの招待へ、あとから送り出さないため。
 */
export const rememberInvite = async (inviteCode: string | undefined): Promise<void> => {
  const store = await cookies()

  if (inviteCode === undefined) {
    store.delete({ name: INVITE_COOKIE, path: PATH })
    return
  }

  store.set(INVITE_COOKIE, inviteCode, {
    path: PATH,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // 認可画面からの戻りは別のサイトからの遷移になるため、`strict` では届かない。
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
  })
}

export const rememberedInvite = async (): Promise<string | undefined> =>
  (await cookies()).get(INVITE_COOKIE)?.value || undefined

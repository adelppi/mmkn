import type { User } from '../../domain/group/user'
import type { UserRepository } from '../../usecase/port/user-repository'
import type { AuthClient } from './client'
import { verificationKeys } from './jwks'

/** セッションの読み取りと、ログインの往復（`docs/adr/0008`「セッションの読み取り」・`docs/adr/0012-login.md`）。 */

/** 認証基盤の user から、mmkn のログイン識別子を取り出す（`docs/adr/0012`「provider が返す ID を識別子にしない理由」）。 */
const loginIdentifierOf = (user: { id: string }): string => user.id

/**
 * 本人であることが確かめられた識別子。ログインしていなければ `undefined`。
 *
 * **確かめ方は署名の検証であり、認証基盤には問い合わせない**（`docs/adr/0008`「セッションの検証」）。
 */
export const currentLoginIdentifier = async (client: AuthClient): Promise<string | undefined> => {
  const { data, error } = await client.auth.getClaims(undefined, { jwks: await verificationKeys() })
  if (error !== null || data === null) return undefined

  return loginIdentifierOf({ id: data.claims.sub })
}

/**
 * 期限切れのトークンを更新させる。**呼ぶのはリクエストの入口（`proxy.ts`）だけである**
 * （`docs/adr/0008`「更新されたセッションの書き戻しは、リクエストの入口で行う」）。
 *
 * 期限内なら往復は起きない。更新できなければ、次に識別子を求めた時点で「ログインしていない」になる。
 */
export const refreshSession = async (client: AuthClient): Promise<void> => {
  await client.auth.getSession()
}

/** 操作する User。ログインしていない、またはその人の User がまだいなければ `undefined`。 */
export const currentUser = async (
  client: AuthClient,
  users: UserRepository,
): Promise<User | undefined> => {
  const loginIdentifier = await currentLoginIdentifier(client)
  if (loginIdentifier === undefined) return undefined

  return users.findByLoginIdentifier(loginIdentifier)
}

/** ログインに使う外部サービス。**正は `docs/adr/0012-login.md`。** */
const LOGIN_SERVICE = 'discord'

/**
 * ログインの往復を始める。返した URL へ送り出す。
 *
 * **スコープを渡さない。** 渡しても足されるだけで、減らせない（`docs/adr/0012`「Discord に要求するスコープ」）。
 */
export const startLogin = async (client: AuthClient, redirectTo: string): Promise<string> => {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: LOGIN_SERVICE,
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error !== null) throw error

  return data.url
}

/**
 * 認可画面から何を持って戻ってきたか。
 *
 * **認証基盤の戻り方を知っているのはこの層だけである。** 本人が断ると `error=access_denied` だけが
 * 付き、認証基盤自身の失敗には `error_code` も付く。
 */
export type LoginReturn =
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'denied' }
  | { readonly kind: 'failed' }

export const loginReturn = (params: URLSearchParams): LoginReturn => {
  const code = params.get('code')
  if (code) return { kind: 'code', code }

  return params.get('error') === 'access_denied' && !params.get('error_code')
    ? { kind: 'denied' }
    : { kind: 'failed' }
}

/** 認可画面から戻ってきた往復を完了させる。`rejected` は認証基盤が受け付けなかったことを表す。 */
export type CompletedLogin =
  | { readonly kind: 'completed'; readonly loginIdentifier: string }
  | { readonly kind: 'rejected'; readonly code: string | undefined }

export const completeLogin = async (client: AuthClient, code: string): Promise<CompletedLogin> => {
  const { data, error } = await client.auth.exchangeCodeForSession(code)
  // **失敗の中身は持ち出さない。** 機械が読む区分だけを返す（`docs/adr/0014-logging.md`）。
  if (error !== null || data.user === null) return { kind: 'rejected', code: error?.code }

  return { kind: 'completed', loginIdentifier: loginIdentifierOf(data.user) }
}

/** セッションを終わらせる。前提条件の判定はユースケース側にある（`src/usecase/account/log-out.ts`）。 */
export const endSession = async (client: AuthClient): Promise<void> => {
  const { error } = await client.auth.signOut()
  // **握りつぶさない。** 終われなかったのに終わったことにすると、次の操作が他人の操作になる。
  if (error !== null) throw error
}

import type { ExternalAccount } from '../../domain/group/login-method'
import type { UserId } from '../../domain/id'
import type { UserRepository } from '../../usecase/port/user-repository'
import type { AuthClient } from './client'
import type { LoginService } from './external-account'

/**
 * セッションの読み取りと、ログインの往復（`docs/adr/0008-layer-internals.md`「セッションの読み取り」・
 * `docs/adr/0012-login.md`）。
 *
 * **ここが返すのは mmkn の `UserId` だけで、ユースケースはセッションの存在を知らない。**
 * cookie へのアクセス手段はアプリ層から注入される（`client.ts`）。
 *
 * **mmkn はパスワードを持たず、メールを送らない**（`docs/adr/0012`）。
 * したがってここには、合言葉の照合も、確認メールも、再設定の導線も存在しない。
 */

/**
 * 認証基盤の user から、mmkn のログイン識別子を取り出す。
 *
 * **識別子は認証基盤が持つ user の識別子**（`docs/adr/0012`「provider が返す ID を識別子に
 * しない理由」）。ログイン手段を増やしても変わらないため、`docs/domain/group.md` が
 * 「どのログイン手段で入っても行き着く先は同じ」と定めているものにそのまま対応する。
 *
 * **provider が返す ID もメールアドレスも識別子に使わない。**
 */
const loginIdentifierOf = (user: { id: string }): string => user.id

/** その user が持つログイン手段。**認証基盤の identity がそのままログイン手段にあたる。** */
const loginMethodsOf = (
  identities: readonly { provider: string; id: string }[],
): readonly ExternalAccount[] =>
  identities.map((identity) => ({ service: identity.provider, id: identity.id }))

/** 本人であることが確かめられた識別子。ログインしていなければ `undefined`。 */
export const currentLoginIdentifier = async (client: AuthClient): Promise<string | undefined> => {
  // `getUser()` は認証基盤に問い合わせて検証する。cookie の中身をそのまま信じない。
  const { data, error } = await client.auth.getUser()
  if (error !== null || data.user === null) return undefined

  return loginIdentifierOf(data.user)
}

/**
 * 現在の `UserId`。ログインしていない、またはその人の User がまだいなければ `undefined`。
 *
 * **識別子から `UserId` への変換は入口で閉じる**（`docs/adr/0004-layers-and-dependencies.md`）。
 * 内側へ流すのは `UserId` だけで、ログイン識別子もログイン手段も流さない。
 */
export const currentUserId = async (
  client: AuthClient,
  users: UserRepository,
): Promise<UserId | undefined> => {
  const loginIdentifier = await currentLoginIdentifier(client)
  if (loginIdentifier === undefined) return undefined

  const user = await users.findByLoginIdentifier(loginIdentifier)
  return user?.id
}

/**
 * ログインの往復を始める。返した URL へ送り出す。
 *
 * **どのサービスでも入口は同じ形**（`docs/domain/group.md`「User と外部アカウント」）。
 * ブラウザではなくサーバーで開始するため、**認証基盤の URL と anon key がブラウザに露出しない**
 * （`.env.example`）。
 */
export const startLogin = async (
  client: AuthClient,
  service: LoginService,
  redirectTo: string,
): Promise<string> => {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: service,
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error !== null) throw error

  return data.url
}

/**
 * 認可画面から戻ってきた往復を完了させる。**ログインとログイン手段の追加の両方がここを通る。**
 *
 * `rejected` は認証基盤が往復を受け付けなかったことを表す。**追加しようとした外部アカウントが
 * 既に別の User のものであるときも、ここで断られる**（`docs/adr/0012`。実際にそうなるかは
 * `docs/operations.md`「実装着手時に必ず確かめること」の手動確認の対象）。
 */
export type CompletedOAuth =
  | {
      readonly kind: 'completed'
      readonly loginIdentifier: string
      readonly loginMethods: readonly ExternalAccount[]
    }
  | { readonly kind: 'rejected'; readonly code: string | undefined }

export const completeOAuth = async (client: AuthClient, code: string): Promise<CompletedOAuth> => {
  const { data, error } = await client.auth.exchangeCodeForSession(code)
  // **失敗の中身は持ち出さない。** 機械が読む区分だけを返す（`docs/adr/0014-logging.md`）。
  if (error !== null || data.user === null) return { kind: 'rejected', code: error?.code }

  return {
    kind: 'completed',
    loginIdentifier: loginIdentifierOf(data.user),
    loginMethods: loginMethodsOf(data.user.identities ?? []),
  }
}

/**
 * セッションを終わらせる。
 *
 * **これはログアウトの一部でしかない。** 前提条件（ログインしていること）の判定は
 * ユースケース側にある（`src/usecase/account/log-out.ts`）。**退会ではないため、
 * User も記録もログイン手段も何一つ消えない**（`docs/features.md`「mmkn が持たないもの」）。
 */
export const endSession = async (client: AuthClient): Promise<void> => {
  const { error } = await client.auth.signOut()
  // **握りつぶさない。** 終われなかったのに終わったことにすると、次の操作が他人の操作になる。
  if (error !== null) throw error
}

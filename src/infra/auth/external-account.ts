import type { UserIdentity } from '@supabase/supabase-js'
import type { UserId } from '../../domain/id'
import type {
  ExternalAccount,
  ExternalAccountRepository,
  LinkExternalAccountOutcome,
} from '../../usecase/port/external-account-repository'
import type { UserRepository } from '../../usecase/port/user-repository'
import type { SqlClient } from '../db/client'
import type { AuthClient } from './client'
import { LOGIN_PROVIDER } from './session'

/**
 * 連携する外部アカウントの参照と記録（`docs/adr/0007-external-account-linking.md`）。
 *
 * **mmkn 側にこの対応のテーブルは無い。** 連携そのものは認証基盤の identity linking に委譲してあり、
 * 対応の実体は認証基盤の内部テーブル（`auth.identities`）にある。**そのスキーマへの依存は
 * このファイルの中だけに閉じる**（将来スキーマが変わっても、自前の射影テーブルに切り替えても、
 * 差し替えるのはここだけで済む）。
 *
 * **アクセストークンは保存しない**（`docs/adr/0007`）。必要なのは「この外部ユーザーの ID」という
 * 一度きりの事実だけで、外部サービスの API を代理で叩き続けることはない。
 *
 * ## 認証基盤の user と mmkn の User の対応
 *
 * 直接の対応表は持たない。**ログインに使う identity（Google）の `provider_id` が
 * mmkn のログイン識別子そのもの**（`docs/adr/0012-login.md`）であるため、そこを経由して引く。
 *
 * ```
 * 連携した identity ─(同じ認証基盤の user)─ Google の identity ─(ログイン識別子)─ mmkn の User
 * ```
 */

/**
 * 連携できる外部サービスと、その OAuth で要求するスコープ。
 *
 * **`identify` にとどめ、メールを取りに行かない**（`docs/adr/0007`「運用上の要件」・
 * `docs/adr/0012`「外部アカウント連携との関係」）。ログインで検証済みのメールアドレスが
 * 必ず認証基盤に入るようになったため、ここで同じアドレスを取得すると
 * **「検証済みメールが一致する identity を自動統合する」挙動が成立する条件がそろう。**
 */
const LINKABLE = { discord: 'identify' } as const

export type LinkableService = keyof typeof LINKABLE

/**
 * 連携の往復を始める。返した URL へ送り出す。
 *
 * **経路はこれ 1 つだけ**（`docs/adr/0007`）。ログイン済みの Web から OAuth で行い、
 * 連携コードのような共有秘密を人が運ぶ経路は持たない。
 */
export const startLinking = async (
  client: AuthClient,
  service: LinkableService,
  redirectTo: string,
): Promise<string> => {
  const { data, error } = await client.auth.linkIdentity({
    provider: service,
    options: { redirectTo, skipBrowserRedirect: true, scopes: LINKABLE[service] },
  })
  if (error !== null) throw error

  return data.url
}

type IdentityRow = { readonly provider: string; readonly provider_id: string }

/** 現在のセッションの user が持つ identity。**他人の identity はここに現れない。** */
const sessionIdentities = async (client: AuthClient): Promise<readonly UserIdentity[]> => {
  const { data, error } = await client.auth.getUserIdentities()
  if (error !== null) throw error

  return data.identities
}

const removeIdentity = async (client: AuthClient, identity: UserIdentity): Promise<void> => {
  const { error } = await client.auth.unlinkIdentity(identity)
  if (error !== null) throw error
}

/**
 * 成立しなかった連携の後始末。**連携が無ければ何もしない。**
 *
 * 認証基盤は往復が完了した時点で identity を作る（`session.ts` の `completeOAuth`）。
 * **mmkn 側が連携を認めなかったのにそれが残ると、「失敗した操作が一部だけ適用された」状態になる**
 * （`docs/domain/group.md`「前提条件を満たさなかったとき」の「起きないこと」）。
 * しかも次にアカウントを作った時点で、連携したつもりのない対応が成立してしまう。
 */
export const abandonLinking = async (
  client: AuthClient,
  account: ExternalAccount,
): Promise<void> => {
  const target = (await sessionIdentities(client)).find(
    (identity) => identity.provider === account.service && identity.id === account.id,
  )
  if (target === undefined) return

  await removeIdentity(client, target)
}

/**
 * `ExternalAccountRepository` の実装。
 *
 * **`link` が呼ばれる時点で、identity は認証基盤が既に作っている。** 認可コードフローを
 * 自前で実装せず認証基盤に委譲した（`docs/adr/0007`「実装」）結果、書き込みは往復の完了
 * （`session.ts` の `completeOAuth`）の側で起きる。**したがってここが担うのは、
 * `docs/domain/group.md` が定める連携の規則を、その結果に対して成立させることである。**
 */
export const supabaseExternalAccountRepository = (deps: {
  sql: SqlClient
  client: AuthClient
  users: UserRepository
}): ExternalAccountRepository => {
  const { sql, client, users } = deps

  /** その外部アカウントを持つ、認証基盤の user。 */
  const authUserIdOfAccount = async (account: ExternalAccount): Promise<string | undefined> => {
    const rows = await sql<{ user_id: string }[]>`
      select user_id
        from auth.identities
       where provider = ${account.service}
         and provider_id = ${account.id}
       limit 1
    `
    return rows[0]?.user_id
  }

  /** mmkn の User に対応する、認証基盤の user。ログインに使う identity を経由して引く。 */
  const authUserIdOfUser = async (userId: UserId): Promise<string | undefined> => {
    const user = await users.findById(userId)
    if (user === undefined) return undefined

    const rows = await sql<{ user_id: string }[]>`
      select user_id
        from auth.identities
       where provider = ${LOGIN_PROVIDER}
         and provider_id = ${user.loginIdentifier}
       limit 1
    `
    return rows[0]?.user_id
  }

  const identitiesOf = async (authUserId: string): Promise<readonly IdentityRow[]> =>
    await sql<IdentityRow[]>`
      select provider, provider_id
        from auth.identities
       where user_id = ${authUserId}::uuid
    `

  /**
   * 認証基盤から identity を 1 つ外す。**現在のセッションの user に対してだけ行える。**
   *
   * `docs/domain/group.md` は「ログインに使う外部アカウントは解除できない」と定めているため、
   * 呼び出し側はログインに使う identity を対象にしない。
   */
  const unlinkIdentityWhere = async (
    authUserId: string,
    matches: (identity: UserIdentity) => boolean,
  ): Promise<void> => {
    const target = (await sessionIdentities(client)).find(matches)
    if (target === undefined) return

    // 認証基盤の解除はセッションに対して行われる。対象がセッションの user でなければ、
    // **黙って別人の連携を外すことになる。** 起こり得ないが、起きたら止める。
    if (target.user_id !== authUserId) {
      throw new Error('セッションの User と、解除の対象の User が一致しない')
    }

    await removeIdentity(client, target)
  }

  return {
    async findUserId(account: ExternalAccount) {
      const authUserId = await authUserIdOfAccount(account)
      if (authUserId === undefined) return undefined

      const identities = await identitiesOf(authUserId)
      const loginIdentifier = identities.find((it) => it.provider === LOGIN_PROVIDER)?.provider_id
      if (loginIdentifier === undefined) return undefined

      const user = await users.findByLoginIdentifier(loginIdentifier)
      return user?.id
    },

    async listByUser(userId: UserId) {
      const authUserId = await authUserIdOfUser(userId)
      if (authUserId === undefined) return []

      // **ログインに使う外部アカウントは、連携の一覧に現れない**
      // （`docs/domain/group.md`「User と外部アカウント」）。
      return (await identitiesOf(authUserId))
        .filter((it) => it.provider !== LOGIN_PROVIDER)
        .map((it) => ({ service: it.provider, id: it.provider_id }))
    },

    async link(userId: UserId, account: ExternalAccount): Promise<LinkExternalAccountOutcome> {
      const actor = await authUserIdOfUser(userId)
      if (actor === undefined) throw new Error('User に対応する identity が認証基盤に無い')

      const owner = await authUserIdOfAccount(account)
      if (owner === undefined) throw new Error('連携したはずの identity が認証基盤に無い')

      // **連携先は移らない。** 認証基盤は往復の時点でこれを断るが、断らなかった場合も
      // ここで止める（`docs/domain/group.md`「外部アカウントを連携する」）。
      if (owner !== actor) return { kind: 'linkedToAnotherUser' }

      const sameService = (await identitiesOf(actor)).filter(
        (it) => it.provider === account.service,
      )
      if (sameService.length > 1) {
        // **1 サービスにつき 1 つ。** 今回増えた分を取り消し、元の連携をそのまま残す。
        // 付け替えは「解除してから連携し直す」で行う。
        await unlinkIdentityWhere(
          actor,
          (it) => it.provider === account.service && it.id === account.id,
        )
        return { kind: 'serviceAlreadyLinked' }
      }

      return { kind: 'linked' }
    },

    async unlink(userId: UserId, service: string) {
      const authUserId = await authUserIdOfUser(userId)
      if (authUserId === undefined) throw new Error('User に対応する identity が認証基盤に無い')

      // 連携が無ければ何も起きない（前提条件の判定はユースケース側にある）。
      await unlinkIdentityWhere(authUserId, (it) => it.provider === service)
    },
  }
}

import type { UserIdentity } from '@supabase/supabase-js'
import { LoginMethod, sameExternalAccount } from '../../domain/group/login-method'
import type { UserId } from '../../domain/id'
import type {
  AddLoginMethodOutcome,
  ExternalAccount,
  ExternalAccountRepository,
} from '../../usecase/port/external-account-repository'
import type { UserRepository } from '../../usecase/port/user-repository'
import type { SqlClient } from '../db/client'
import type { AuthClient } from './client'

/**
 * ログイン手段（外部アカウント）と User の対応（`docs/adr/0012-login.md`）。
 *
 * **mmkn 側にこの対応のテーブルは無い。** 複数のログイン手段の管理は認証基盤の identity linking に
 * 委譲してあり、対応の実体は認証基盤の内部テーブル（`auth.identities`）にある。**そのスキーマへの
 * 依存はこのファイルの中だけに閉じる**（将来スキーマが変わっても、自前の射影テーブルに切り替えても、
 * 差し替えるのはここだけで済む）。
 *
 * **アクセストークンは保存しない**（`docs/adr/0012`）。必要なのは「この外部ユーザーの ID」という
 * 一度きりの事実だけで、外部サービスの API を代理で叩き続けることはない。
 *
 * ## 認証基盤の user と mmkn の User の対応
 *
 * **mmkn のログイン識別子が、認証基盤の user の識別子そのもの**（`docs/adr/0012`）。
 * 間に変換を挟まずに引ける。
 *
 * ```
 * ログイン手段（identity）─(user_id)─ 認証基盤の user ≡ ログイン識別子 ─ mmkn の User
 * ```
 */

/**
 * ログイン手段にできる外部サービスと、その OAuth で要求するスコープ。
 * **正は `docs/adr/0012-login.md`。**
 *
 * Discord のスコープを `identify` にとどめてメールを取得しないのは、認証基盤の
 * 「**検証済みメールが一致する identity を自動統合する**」挙動を誘発しないためである。
 * ログイン手段の追加は、**必ず本人の明示的な操作でだけ成立させる**（`docs/adr/0012`「自動統合に頼らない」）。
 */
export const LOGIN_SERVICES = {
  google: undefined,
  discord: 'identify',
} as const

export type LoginService = keyof typeof LOGIN_SERVICES

/**
 * ログイン手段を追加する往復を始める。返した URL へ送り出す。
 *
 * **経路はこれ 1 つだけ**（`docs/adr/0012`）。ログイン済みの Web から OAuth で行い、
 * 連携コードのような共有秘密を人が運ぶ経路は持たない。
 */
export const startAddingLoginMethod = async (
  client: AuthClient,
  service: LoginService,
  redirectTo: string,
): Promise<string> => {
  const { data, error } = await client.auth.linkIdentity({
    provider: service,
    options: { redirectTo, skipBrowserRedirect: true, scopes: LOGIN_SERVICES[service] },
  })
  if (error !== null) throw error

  return data.url
}

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

const asExternalAccount = (identity: { provider: string; id: string }): ExternalAccount => ({
  service: identity.provider,
  id: identity.id,
})

/**
 * 成立しなかった追加の後始末。**そのログイン手段が無ければ何もしない。**
 *
 * 認証基盤は往復が完了した時点で identity を作る（`session.ts` の `completeOAuth`）。
 * **mmkn 側が追加を認めなかったのにそれが残ると、「失敗した操作が一部だけ適用された」状態になる**
 * （`docs/domain/group.md`「前提条件を満たさなかったとき」の「起きないこと」）。
 * しかも次にログインした時点で、増やしたつもりのない入口が成立してしまう。
 */
export const abandonAddingLoginMethod = async (
  client: AuthClient,
  account: ExternalAccount,
): Promise<void> => {
  const target = (await sessionIdentities(client)).find((identity) =>
    sameExternalAccount(asExternalAccount(identity), account),
  )
  if (target === undefined) return

  await removeIdentity(client, target)
}

type IdentityRow = { readonly provider: string; readonly provider_id: string }

/**
 * `ExternalAccountRepository` の実装。
 *
 * **`add` が呼ばれる時点で、identity は認証基盤が既に作っている。** 認可コードフローを
 * 自前で実装せず認証基盤に委譲した（`docs/adr/0012`「決定」）結果、書き込みは往復の完了
 * （`session.ts` の `completeOAuth`）の側で起きる。**したがってここが担うのは、
 * `docs/domain/group.md` が定めるログイン手段の規則を、その結果に対して成立させることである。**
 */
export const supabaseExternalAccountRepository = (deps: {
  sql: SqlClient
  client: AuthClient
  users: UserRepository
}): ExternalAccountRepository => {
  const { sql, client, users } = deps

  /** その外部アカウントをログイン手段とする、認証基盤の user。 */
  const ownerOf = async (account: ExternalAccount): Promise<string | undefined> => {
    const rows = await sql<{ user_id: string }[]>`
      select user_id
        from auth.identities
       where provider = ${account.service}
         and provider_id = ${account.id}
       limit 1
    `
    return rows[0]?.user_id
  }

  /**
   * mmkn の User に対応する、認証基盤の user。
   *
   * **ログイン識別子がその識別子そのものであるため、問い合わせは要らない**（`docs/adr/0012`）。
   */
  const authUserIdOf = async (userId: UserId): Promise<string | undefined> =>
    (await users.findById(userId))?.loginIdentifier

  const identitiesOf = async (authUserId: string): Promise<readonly ExternalAccount[]> => {
    const rows = await sql<IdentityRow[]>`
      select provider, provider_id
        from auth.identities
       where user_id = ${authUserId}::uuid
    `
    return rows.map((row) => ({ service: row.provider, id: row.provider_id }))
  }

  return {
    async findUserId(account: ExternalAccount) {
      const authUserId = await ownerOf(account)
      if (authUserId === undefined) return undefined

      // ログイン識別子 = 認証基盤の user の識別子。そのまま引ける。
      const user = await users.findByLoginIdentifier(authUserId)
      return user?.id
    },

    async listByUser(userId: UserId) {
      const authUserId = await authUserIdOf(userId)
      if (authUserId === undefined) return []

      return await identitiesOf(authUserId)
    },

    async add(userId: UserId, account: ExternalAccount): Promise<AddLoginMethodOutcome> {
      const actor = await authUserIdOf(userId)
      if (actor === undefined) throw new Error('User に対応する user が認証基盤に無い')

      const owner = await ownerOf(account)
      if (owner === undefined) throw new Error('追加したはずの identity が認証基盤に無い')

      // **移らない。** 認証基盤は往復の時点でこれを断るが、断らなかった場合もここで止める
      // （`docs/domain/group.md`「ログイン手段を追加する」）。
      if (owner !== actor) return { kind: 'usedByAnotherUser' }

      // **判定はドメイン層のものを呼ぶ。** 渡すのは「追加する前の一覧」であり、
      // 認証基盤が既に作った分をここで除く。
      const current = await identitiesOf(actor)
      const before = current.filter((method) => !sameExternalAccount(method, account))

      const allowed = LoginMethod.requireAddable(before, account)
      if (!allowed.ok) {
        // 成立しなかった分を戻し、元のログイン手段をそのまま残す。
        await abandonAddingLoginMethod(client, account)
        return allowed.error
      }

      return { kind: 'added' }
    },

    async remove(userId: UserId, account: ExternalAccount) {
      const authUserId = await authUserIdOf(userId)
      if (authUserId === undefined) throw new Error('User に対応する user が認証基盤に無い')

      const target = (await sessionIdentities(client)).find((identity) =>
        sameExternalAccount(asExternalAccount(identity), account),
      )
      // ログイン手段が無ければ何も起きない（前提条件の判定はユースケース側にある）。
      if (target === undefined) return

      // 認証基盤の削除はセッションに対して行われる。対象がセッションの user でなければ、
      // **黙って別人のログイン手段を外すことになる。** 起こり得ないが、起きたら止める。
      if (target.user_id !== authUserId) {
        throw new Error('セッションの User と、削除の対象の User が一致しない')
      }

      await removeIdentity(client, target)
    },
  }
}

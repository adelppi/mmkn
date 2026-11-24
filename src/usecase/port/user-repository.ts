import type { User } from '../../domain/group/user'
import type { UserId } from '../../domain/id'

/** User の永続化ポート（`docs/domain/group.md`「User の属性」）。 */

/** `loginIdentifierTaken` は DB の制約で判定する（`docs/adr/0005`「一意性・参照の整合」）。 */
export type CreateUserOutcome =
  | { readonly kind: 'created' }
  | { readonly kind: 'loginIdentifierTaken' }

export type UserRepository = {
  findById(id: UserId): Promise<User | undefined>

  /** ログイン識別子から User を読む。識別子が何かは `docs/adr/0012-login.md` を正とする。 */
  findByLoginIdentifier(loginIdentifier: string): Promise<User | undefined>

  create(user: User): Promise<CreateUserOutcome>
}

import type { User } from '../../domain/group/user'
import type { UserId } from '../../domain/id'

/**
 * User の永続化ポート（`docs/domain/group.md`「User の属性」）。
 *
 * User は Group の集約に含まれない。Member が指す先であり、グループをまたいで同一であるため。
 */

/**
 * 作成の結果。
 *
 * `loginIdentifierTaken` は「**同じログイン識別子の User が 2 つできることはない**」
 * （`docs/domain/group.md`「アカウントを作成する」）を実際に成立させるためのもの。
 * 一意性は同時実行でしか壊れないため、判定は DB の制約が担う
 * （`docs/adr/0005-data-access-and-authorization.md`「一意性・参照の整合」）。
 */
export type CreateUserOutcome =
  | { readonly kind: 'created' }
  | { readonly kind: 'loginIdentifierTaken' }

export type UserRepository = {
  findById(id: UserId): Promise<User | undefined>

  /** ログイン識別子から User を読む。識別子が何かは `docs/adr/0012-login.md` を正とする。 */
  findByLoginIdentifier(loginIdentifier: string): Promise<User | undefined>

  create(user: User): Promise<CreateUserOutcome>
}

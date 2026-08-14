import type { User } from '../../../domain/group/user'
import { toUserId } from '../../../domain/id'

/**
 * `users` の行と `User` の変換。
 *
 * **行の形をここで明示的に宣言する。** ORM の推論型（`typeof users.$inferSelect`）を
 * 使わないのは、`infra/db/mapper` を「ORM の推論型がリポジトリの外へ漏れない壁」とするため
 * （`docs/adr/0008-layer-internals.md`）。
 */
export type UserRow = {
  readonly id: string
  readonly name: string
  readonly loginIdentifier: string
}

export const toUser = (row: UserRow): User => ({
  id: toUserId(row.id),
  name: row.name,
  loginIdentifier: row.loginIdentifier,
})

export const fromUser = (user: User): UserRow => ({
  id: user.id,
  name: user.name,
  loginIdentifier: user.loginIdentifier,
})

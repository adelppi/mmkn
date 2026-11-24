/**
 * 一意性の制約に当たったことを見分ける（`docs/adr/0005`「一意性・参照の整合」）。
 *
 * **どの制約に当たったかまで見る。** 見ないと、別の制約違反まで同じ失敗として扱ってしまう。
 */

/** Postgres の `unique_violation`。 */
const UNIQUE_VIOLATION = '23505'

/** ORM が元の例外を包むため、包みの何段か内側まで見る。 */
const MAX_DEPTH = 5

type DriverError = { readonly code: unknown; readonly constraint_name?: unknown }

const isDriverError = (value: unknown): value is DriverError =>
  typeof value === 'object' && value !== null && 'code' in value

const driverError = (error: unknown): DriverError | undefined => {
  let current = error

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (isDriverError(current)) return current
    if (typeof current !== 'object' || current === null || !('cause' in current)) return undefined
    current = current.cause
  }

  return undefined
}

export const isUniqueViolation = (error: unknown, constraint: string): boolean => {
  const driver = driverError(error)

  return driver?.code === UNIQUE_VIOLATION && driver.constraint_name === constraint
}

/** 制約の名前。`src/infra/db/schema.ts` で明示的に付けたものと揃える。 */
export const USERS_LOGIN_IDENTIFIER_UNIQUE = 'users_login_identifier_unique'
export const GROUPS_INVITE_CODE_UNIQUE = 'groups_invite_code_unique'

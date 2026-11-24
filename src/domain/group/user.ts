import type { UserId } from '../id'
import { err, ok, type Result } from '../result'
import { constrainText, USER_NAME_MAX_LENGTH } from './text'

/** mmkn を利用する人そのもの（`docs/domain/group.md`「User の属性」）。 */
export type User = {
  readonly id: UserId
  /** mmkn 全体での名前。グループ内表示名の初期値に使う。 */
  readonly name: string
  /**
   * ログインしたときに行き着く、その人を指すもの（`docs/domain/group.md`「User の属性」）。
   * 何を識別子とするかは `docs/adr/0012-login.md` を正とする。
   */
  readonly loginIdentifier: string
}

/** User の名前が制約を満たさなかったときの失敗。 */
export type UserNameInvalid = { kind: 'nameEmpty' } | { kind: 'nameTooLong' }

const create = (input: {
  id: UserId
  name: string
  loginIdentifier: string
}): Result<User, UserNameInvalid> => {
  const name = constrainText(input.name, USER_NAME_MAX_LENGTH)
  if (!name.ok) {
    return err(name.error === 'empty' ? { kind: 'nameEmpty' } : { kind: 'nameTooLong' })
  }

  return ok({ id: input.id, name: name.value, loginIdentifier: input.loginIdentifier })
}

/**
 * User への操作（`docs/domain/group.md`「アカウントを作成する」）。
 *
 * ログイン識別子の一意性は DB の制約が担う（`docs/adr/0005`「一意性・参照の整合」）。
 */
export const User = { create }

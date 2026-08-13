import type { UserId } from '../id'
import { err, ok, type Result } from '../result'
import { constrainText, USER_NAME_MAX_LENGTH } from './text'

/**
 * mmkn を利用する人そのもの。グループをまたいで同一（`docs/domain/group.md`「User の属性」）。
 *
 * `Member`（ある Group における立場）とは別のもの。記録が指す先は常に Member。
 */
export type User = {
  readonly id: UserId
  /** mmkn 全体での名前。グループ内表示名の初期値に使う。 */
  readonly name: string
  /**
   * ログインするときに User を指すもの。名前とは別のものであり、名前を変えても変わらない。
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
 * ID は受け取るだけで、ここでは作らない（`docs/adr/0008-layer-internals.md`）。
 * 「同じログイン識別子の User が 2 つできない」は 1 人の User だけを見ても判定できないため、
 * ここでは扱わない（実現は `docs/adr/0005-data-access-and-authorization.md`「一意性・参照の整合」）。
 */
export const User = { create }

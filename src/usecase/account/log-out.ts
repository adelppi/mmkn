import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * ログアウトする（`docs/domain/group.md`「ログアウトする」）。
 *
 * **ここが持つのは前提条件の判定だけ。** 呼び出し側は、これが成功したときにセッションを終わらせる。
 */

export type LogOutInput = {
  readonly actor: UserId | undefined
}

export type LogOutError = { readonly kind: 'notAuthenticated' }

export const logOut =
  (deps: { users: UserRepository }): UseCase<LogOutInput, void, LogOutError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    // 操作する User が存在しなければ、その人はログインしていないのと同じ扱いになる
    // （`docs/domain/group.md`「前提条件を満たさなかったとき」の 1 行目）。
    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    return ok(undefined)
  }

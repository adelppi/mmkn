import type { User } from '../../domain/group/user'
import { err, ok } from '../../domain/result'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * ログインする（`docs/domain/group.md`「ログインする」）。
 *
 * 本人であることは認証基盤が確かめ済みで、**ここが見るのはその識別子の User がいるかだけ**である。
 */

export type LogInInput = {
  readonly loginIdentifier: string
}

/** `accountNotFound` は「本人ではあるが、その人の User がまだいない」を指す。**未ログインとは別のもの。** */
export type LogInError = { readonly kind: 'accountNotFound' }

export const logIn =
  (deps: { users: UserRepository }): UseCase<LogInInput, User, LogInError> =>
  async (input) => {
    const user = await deps.users.findByLoginIdentifier(input.loginIdentifier)
    if (user === undefined) return err({ kind: 'accountNotFound' })

    // 以降の操作が、その User の操作として扱われる。
    // **Group・Member・記録は一切変わらない**（`docs/domain/group.md`「ログインする」）。
    return ok(user)
  }

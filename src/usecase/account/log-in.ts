import type { User } from '../../domain/group/user'
import { err, ok } from '../../domain/result'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * ログインする（`docs/domain/group.md`「ログインする」・`docs/features.md` #11）。
 *
 * 前提条件は「**示された外部アカウントをログイン手段とする User が存在し、本人であることが
 * 確かめられること**」。後半は認証基盤が済ませたうえでここへ届く（`docs/adr/0012-login.md`）ため、**ここが確かめるのは
 * その識別子の User が mmkn にいるかだけ**になる。
 *
 * **User は作られない。** アカウントの作成は `create-account.ts` の責務である。
 */

export type LogInInput = {
  readonly loginIdentifier: string
}

/**
 * 失敗。
 *
 * `accountNotFound` は「本人であることは確かめられたが、その人の User がまだいない」を指す。
 * **未ログインとは別のもの**で、案内すべきことも違う（ログインではなくアカウントの作成へ導く）。
 */
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

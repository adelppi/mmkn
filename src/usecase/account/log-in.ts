import type { User } from '../../domain/group/user'
import { err, ok } from '../../domain/result'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * ログインする（`docs/domain/group.md`「ログインする」・`docs/features.md` #11）。
 *
 * 前提条件は「**示された識別子の User が存在し、本人であることが確かめられること**」。
 * 後半は認証基盤が済ませたうえでここへ届く（`docs/adr/0012-login.md`）ため、
 * ここが確かめるのは前半（その識別子の User が mmkn にいるか）だけになる。
 *
 * **User は作られない。** 登録されていない識別子でログインしようとしても、新しい User はできない。
 * アカウントの作成は `create-account.ts` の責務であり、名前の入力を伴う別の操作である。
 */

export type LogInInput = {
  readonly loginIdentifier: string
}

/**
 * 失敗。
 *
 * `accountNotFound` は「本人であることは確かめられたが、その識別子の User がまだいない」を指す。
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

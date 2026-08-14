import { User, type UserNameInvalid } from '../../domain/group/user'
import { err, ok } from '../../domain/result'
import type { IdGenerator } from '../port/id-generator'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * アカウントを作成する（`docs/domain/group.md`「アカウントを作成する」・`docs/features.md` #11）。
 *
 * **前提条件は無い。** ログインしていない人が行う操作であるため、`actor` を取らない。
 *
 * **ログインに使う外部アカウントは、本人であることが確かめられた状態で受け取る。**
 * 確かめる手段は認証基盤に委ねてあり（`docs/adr/0012-login.md`）、ここへ届くのは
 * その結果の識別子だけである。**ユースケースはセッションの存在を知らない**
 * （`docs/adr/0008-layer-internals.md`「セッションの読み取り」）。
 */

export type CreateAccountInput = {
  /**
   * ログインするときに User を指すもの。**名前とは別のもの。**
   * 何を識別子とするかは `docs/adr/0012-login.md` を正とする。
   */
  readonly loginIdentifier: string
  readonly name: string
}

/**
 * 失敗。
 *
 * `loginIdentifierTaken` は「**同じログイン識別子の User が 2 つできることはない**」
 * （`docs/domain/group.md`）にあたる。判定は 1 人の User だけを見てもできないため
 * ドメインでは扱わず、DB の制約が担う（`docs/adr/0005`「一意性・参照の整合」）。
 */
export type CreateAccountError = UserNameInvalid | { readonly kind: 'loginIdentifierTaken' }

export const createAccount =
  (deps: { users: UserRepository; ids: IdGenerator }): UseCase<
    CreateAccountInput,
    User,
    CreateAccountError
  > =>
  async (input) => {
    const user = User.create({
      id: deps.ids.userId(),
      name: input.name,
      loginIdentifier: input.loginIdentifier,
    })
    if (!user.ok) return user

    const outcome = await deps.users.create(user.value)
    if (outcome.kind === 'loginIdentifierTaken') return err({ kind: 'loginIdentifierTaken' })

    // **Group・Member は作られず、連携する外部アカウントも増えない**（`docs/domain/group.md`
    // 「アカウントを作成する」の「起きないこと」）。ログインしたことは連携を意味しない。
    return ok(user.value)
  }

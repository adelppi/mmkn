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
 * **外部アカウントは、本人であることが確かめられた状態で受け取る。** 確かめる手段は
 * 認証基盤に委ねてあり（`docs/adr/0012-login.md`）、ここへ届くのはその結果の識別子だけである。
 * **ユースケースはセッションの存在を知らない**（`docs/adr/0008-layer-internals.md`「セッションの読み取り」）。
 *
 * **そのアカウントが最初のログイン手段になる。** 2 つ目以降を増やすのは
 * `add-login-method.ts` の責務であり、ここは 1 つだけを与える。
 */

export type CreateAccountInput = {
  /**
   * ログインしたときに行き着く、その人を指すもの。**名前ともログイン手段とも別のもの。**
   * 何を識別子とするかは `docs/adr/0012-login.md` を正とする。
   */
  readonly loginIdentifier: string
  readonly name: string
}

/**
 * 失敗。
 *
 * `alreadyRegistered` は「**1 つの外部アカウントから、2 つの User ができることはない**」
 * （`docs/domain/group.md`）にあたる。判定は 1 人の User だけを見てもできないため
 * ドメインでは扱わず、DB の制約が担う（`docs/adr/0005`「一意性・参照の整合」）。
 */
export type CreateAccountError = UserNameInvalid | { readonly kind: 'alreadyRegistered' }

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
    if (outcome.kind === 'loginIdentifierTaken') return err({ kind: 'alreadyRegistered' })

    // **Group・Member は作られず、ログイン手段も 2 つ以上にならない**（`docs/domain/group.md`
    // 「アカウントを作成する」の「起きないこと」）。
    return ok(user.value)
  }

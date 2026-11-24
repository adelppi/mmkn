import { User, type UserNameInvalid } from '../../domain/group/user'
import { err, ok } from '../../domain/result'
import type { IdGenerator } from '../port/id-generator'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/** アカウントを作成する（`docs/domain/group.md`「アカウントを作成する」）。 */

export type CreateAccountInput = {
  /** 本人であることが確かめられた結果として届く（`docs/adr/0012-login.md`）。 */
  readonly loginIdentifier: string
  readonly name: string
}

/** `alreadyRegistered` の判定は DB の制約が担う（`docs/adr/0005`「一意性・参照の整合」）。 */
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

    // **Group・Member は作られない**（`docs/domain/group.md`
    // 「アカウントを作成する」の「起きないこと」）。
    return ok(user.value)
  }

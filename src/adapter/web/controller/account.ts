import type {
  CreateAccountError,
  CreateAccountInput,
} from '../../../usecase/account/create-account'
import type { User } from '../../../domain/group/user'
import type { UseCase } from '../../../usecase/usecase'
import { toCreateAccountView, type CreateAccountView } from '../presenter/account'
import { field, optionalField } from '../presenter/form'

/** アカウントへの操作（`docs/adr/0008-layer-internals.md`「Controller と Presenter」）。 */

/**
 * アカウントを作成する（`docs/domain/group.md`「アカウントを作成する」）。
 *
 * **ログイン識別子は入力から取らない。** 取れる形にすると、他人の識別子を打ち込む経路ができる。
 */
export const createAccount =
  (deps: {
    createAccount: UseCase<CreateAccountInput, User, CreateAccountError>
    loginIdentifier: string | undefined
  }) =>
  async (_previous: CreateAccountView, data: FormData): Promise<CreateAccountView> => {
    const input = { name: field(data, 'name'), inviteCode: optionalField(data, 'inviteCode') }

    if (deps.loginIdentifier === undefined) {
      return toCreateAccountView(input, { ok: false, error: { kind: 'notAuthenticated' } })
    }

    return toCreateAccountView(
      input,
      await deps.createAccount({ loginIdentifier: deps.loginIdentifier, name: input.name }),
    )
  }

import type {
  CreateAccountError,
  CreateAccountInput,
} from '../../../usecase/account/create-account'
import type { User } from '../../../domain/group/user'
import type { UseCase } from '../../../usecase/usecase'
import { toCreateAccountView, type CreateAccountView } from '../presenter/account'
import { field } from '../presenter/form'

/**
 * アカウントへの操作（`docs/adr/0008-layer-internals.md`「Controller と Presenter」）。
 *
 * **外から届いた入力をユースケースの入力に変換し、ユースケースを呼び、Presenter に渡す。**
 * ここに業務ルールを書かない（判定はドメイン層。`docs/adr/0005`）。
 *
 * シグネチャは「直前の状態と入力を受けて、次の状態を返す」形にそろえる
 * （`docs/adr/0009-web-ui.md`「フォーム」）。
 */

/**
 * アカウントを作成する（`docs/domain/group.md`「アカウントを作成する」）。
 *
 * **ログイン識別子は入力から取らない。** 本人であることが確かめられた結果として届くものを
 * 合成ルート側から受け取る（`docs/adr/0012-login.md`）。**入力から取れる形にすると、
 * 他人の識別子を打ち込む経路ができる。**
 */
export const createAccount =
  (deps: {
    createAccount: UseCase<CreateAccountInput, User, CreateAccountError>
    loginIdentifier: string | undefined
  }) =>
  async (_previous: CreateAccountView, data: FormData): Promise<CreateAccountView> => {
    const name = field(data, 'name')

    if (deps.loginIdentifier === undefined) {
      return toCreateAccountView(name, { ok: false, error: { kind: 'notAuthenticated' } })
    }

    return toCreateAccountView(
      name,
      await deps.createAccount({ loginIdentifier: deps.loginIdentifier, name }),
    )
  }

import type { ExternalAccount } from '../../domain/group/login-method'
import type { User } from '../../domain/group/user'
import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { ExternalAccountRepository } from '../port/external-account-repository'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * 自分のアカウントと、そのログイン手段を見る（`docs/domain/group.md`「User と外部アカウント」・
 * `docs/features.md` #12）。
 *
 * **読み取りもユースケースを通す**（`docs/adr/0009-web-ui.md`）。
 *
 * 返すのは**自分のログイン手段だけ**である。他人のログイン手段を引く経路をここに作らない。
 */

export type ViewAccountInput = {
  readonly actor: UserId | undefined
}

export type ViewAccountOutput = {
  readonly user: User
  /** **1 つ以上ある**（`docs/domain/group.md`：ログイン手段を持たない User は存在しない）。 */
  readonly loginMethods: readonly ExternalAccount[]
}

export type ViewAccountError = { readonly kind: 'notAuthenticated' }

export const viewAccount =
  (deps: { users: UserRepository; externalAccounts: ExternalAccountRepository }): UseCase<
    ViewAccountInput,
    ViewAccountOutput,
    ViewAccountError
  > =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    return ok({ user, loginMethods: await deps.externalAccounts.listByUser(input.actor) })
  }

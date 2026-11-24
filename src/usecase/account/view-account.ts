import type { User } from '../../domain/group/user'
import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * 自分のアカウントを見る（`docs/features.md` #11）。
 *
 * **読み取りもユースケースを通す**（`docs/adr/0009-web-ui.md`）。
 */

export type ViewAccountInput = {
  readonly actor: UserId | undefined
}

export type ViewAccountError = { readonly kind: 'notAuthenticated' }

export const viewAccount =
  (deps: { users: UserRepository }): UseCase<ViewAccountInput, User, ViewAccountError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    return ok(user)
  }

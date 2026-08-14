import { LoginMethod, type RemoveLoginMethodFailure } from '../../domain/group/login-method'
import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { ExternalAccountRepository } from '../port/external-account-repository'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * ログイン手段を削除する（`docs/domain/group.md`「ログイン手段を削除する」・
 * `docs/features.md` #12）。
 *
 * 前提条件は「その User に、そのサービスのログイン手段があること。**かつ、削除したあとも
 * 1 つ以上残ること**」。**判定はドメイン層が行う**（`src/domain/group/login-method.ts`）。
 *
 * **削除しても何も壊れない。** 過去の記録は Member を指しており、外部アカウントを指していない。
 * その User が対応づけた「場と Group の対応」も変わらない。
 */

export type RemoveLoginMethodInput = {
  readonly actor: UserId | undefined
  /** 削除するサービス。**1 サービスにつき 1 つ**であるため、これで一意に定まる。 */
  readonly service: string
}

export type RemoveLoginMethodError =
  | { readonly kind: 'notAuthenticated' }
  | RemoveLoginMethodFailure

export const removeLoginMethod =
  (deps: {
    users: UserRepository
    externalAccounts: ExternalAccountRepository
  }): UseCase<RemoveLoginMethodInput, void, RemoveLoginMethodError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    const methods = await deps.externalAccounts.listByUser(input.actor)

    const target = LoginMethod.requireRemovable(methods, input.service)
    if (!target.ok) return target

    await deps.externalAccounts.remove(input.actor, target.value)

    return ok(undefined)
  }

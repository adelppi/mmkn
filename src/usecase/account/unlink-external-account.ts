import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { ExternalAccountRepository } from '../port/external-account-repository'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * 外部アカウントの連携を解除する（`docs/domain/group.md`「外部アカウントの連携を解除する」・
 * `docs/features.md` #12）。
 *
 * 前提条件は「**その User に、そのサービスの連携があること**」。
 *
 * **解除しても何も壊れない。** 過去の記録は Member を指しており、外部アカウントを指していない。
 * その User が対応づけた「場と Group の対応」も変わらない（対応は場と Group の間のものであり、
 * 対応づけた人に紐づかない）。
 *
 * **ログインに使う外部アカウントはここで解除できない。** 一覧にも現れない別の役割であり、
 * 解除する手段も別のアカウントに移す手段も持たない（`docs/domain/group.md`「User と外部アカウント」）。
 */

export type UnlinkExternalAccountInput = {
  readonly actor: UserId | undefined
  /** 解除する連携のサービス種別。**1 サービスにつき 1 つ**であるため、これで一意に定まる。 */
  readonly service: string
}

/**
 * 失敗。
 *
 * `notLinked` は前提条件（そのサービスの連携があること）を満たさなかったことを指す。
 * **黙って成功にしない**（`docs/domain/group.md`「前提条件を満たさなかったとき」）。
 */
export type UnlinkExternalAccountError =
  | { readonly kind: 'notAuthenticated' }
  | { readonly kind: 'notLinked' }

export const unlinkExternalAccount =
  (deps: {
    users: UserRepository
    externalAccounts: ExternalAccountRepository
  }): UseCase<UnlinkExternalAccountInput, void, UnlinkExternalAccountError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    const linked = await deps.externalAccounts.listByUser(input.actor)
    if (!linked.some((account) => account.service === input.service)) {
      return err({ kind: 'notLinked' })
    }

    await deps.externalAccounts.unlink(input.actor, input.service)

    return ok(undefined)
  }

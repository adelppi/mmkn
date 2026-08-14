import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type {
  ExternalAccount,
  ExternalAccountRepository,
} from '../port/external-account-repository'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * 外部アカウントを連携する（`docs/domain/group.md`「外部アカウントを連携する」・
 * `docs/features.md` #12）。
 *
 * 前提条件は「**操作する人が、mmkn の User として既にログインしていること**」。
 * 連携する外部アカウントの側は、認可画面をまたいだ往復で本人であることが確かめられた状態で届く
 * （`docs/adr/0007-external-account-linking.md`）。**ユーザー自身に外部 ID を入力させる経路は無い。**
 *
 * ここで扱うのは**連携する**外部アカウントだけで、**ログインに使う**ものは含まない
 * （`docs/domain/group.md`「User と外部アカウント」。役割が違い、解除できるかどうかも違う）。
 */

export type LinkExternalAccountInput = {
  readonly actor: UserId | undefined
  readonly account: ExternalAccount
}

/**
 * 失敗。
 *
 * - `linkedToAnotherUser` … その外部アカウントが既に別の User に連携されている。
 *   **連携は失敗し、連携先は移らない。** 付け替えは、元の User が自分で解除してから行う
 * - `serviceAlreadyLinked` … その User が既に同じサービスのアカウントを連携している
 *   （**1 サービスにつき 1 つ**）。付け替えは解除してから連携し直す
 */
export type LinkExternalAccountError =
  | { readonly kind: 'notAuthenticated' }
  | { readonly kind: 'linkedToAnotherUser' }
  | { readonly kind: 'serviceAlreadyLinked' }

export const linkExternalAccount =
  (deps: {
    users: UserRepository
    externalAccounts: ExternalAccountRepository
  }): UseCase<LinkExternalAccountInput, ExternalAccount, LinkExternalAccountError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    const outcome = await deps.externalAccounts.link(input.actor, input.account)
    switch (outcome.kind) {
      case 'linkedToAnotherUser':
        return err({ kind: 'linkedToAnotherUser' })
      case 'serviceAlreadyLinked':
        return err({ kind: 'serviceAlreadyLinked' })
      case 'linked':
        // **新しい User は作られず、Group・Member も一切変わらない。連携は参加ではない。**
        // **User の名前も、外部サービス側の名前で上書きされない**（`docs/domain/group.md`）。
        return ok(input.account)
    }
  }

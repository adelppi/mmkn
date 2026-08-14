import type { ExternalAccount } from '../../domain/group/login-method'
import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { ExternalAccountRepository } from '../port/external-account-repository'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * ログイン手段を追加する（`docs/domain/group.md`「ログイン手段を追加する」・
 * `docs/features.md` #12）。
 *
 * 前提条件は「**操作する人が、mmkn の User として既にログインしていること**」。
 * 追加する外部アカウントの側は、認可画面をまたいだ往復で本人であることが確かめられた状態で届く
 * （`docs/adr/0012-login.md`）。**ユーザー自身に外部 ID を入力させる経路は無い。**
 *
 * **増えるのは入口だけで、行き着く先は同じ User。** ログイン識別子も、Group・Member・記録も変わらない。
 */

export type AddLoginMethodInput = {
  readonly actor: UserId | undefined
  readonly account: ExternalAccount
}

/**
 * 失敗。
 *
 * - `usedByAnotherUser` … その外部アカウントが既に別の User のログイン手段である。
 *   **追加は失敗し、そちらのログイン手段のままになる。** 付け替えは、元の User が自分で削除してから行う
 * - `serviceAlreadyUsed` … その User が既に同じサービスのアカウントを持っている
 *   （**1 サービスにつき 1 つ**）。付け替えは削除してから追加し直す
 */
export type AddLoginMethodError =
  | { readonly kind: 'notAuthenticated' }
  | { readonly kind: 'usedByAnotherUser' }
  | { readonly kind: 'serviceAlreadyUsed' }

export const addLoginMethod =
  (deps: {
    users: UserRepository
    externalAccounts: ExternalAccountRepository
  }): UseCase<AddLoginMethodInput, ExternalAccount, AddLoginMethodError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    const outcome = await deps.externalAccounts.add(input.actor, input.account)
    switch (outcome.kind) {
      case 'usedByAnotherUser':
        return err({ kind: 'usedByAnotherUser' })
      case 'serviceAlreadyUsed':
        return err({ kind: 'serviceAlreadyUsed' })
      case 'added':
        // **新しい User は作られず、Group・Member も一切変わらない。**
        // **User の名前も、外部サービス側の名前で上書きされない**（`docs/domain/group.md`）。
        return ok(input.account)
    }
  }

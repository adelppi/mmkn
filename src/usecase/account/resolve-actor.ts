import type { ExternalAccount } from '../../domain/group/login-method'
import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { ExternalAccountRepository } from '../port/external-account-repository'
import type { UseCase } from '../usecase'

/**
 * 外部サービスから届いた操作が、どの User のものかを解決する
 * （`docs/domain/group.md`「User と外部アカウント」）。
 *
 * **そのサービスのアカウントをログイン手段にしている User が、その操作の主になる。**
 * 「連携」という別の対応は持たない（`docs/adr/0012-login.md`）。
 *
 * **読み取りだけを行う。** 見つからなくても User は作らず、Group・Member・記録も一切変わらない
 * （`docs/domain/group.md`「mmkn のアカウントを持たない人が、外部サービスから操作したとき」）。
 *
 * リポジトリを外部サービスの入口から直接呼ばずここを通すのは、
 * **ユースケースを通さないデータアクセス経路を作らないため**（`docs/adr/0005-data-access-and-authorization.md`）。
 * 相関 ID 付きのログもここで揃う（`docs/adr/0014-logging.md`）。
 */

export type ResolveActorInput = {
  readonly account: ExternalAccount
}

export type ResolveActorOutput = {
  /** 操作する User。**入口より内側へ流れるのはこれだけ**（`docs/adr/0004-layers-and-dependencies.md`）。 */
  readonly actor: UserId
}

/** そのアカウントをログイン手段とする User がいない ＝ **mmkn のアカウントをまだ持っていない。** */
export type ResolveActorError = { readonly kind: 'noAccount' }

export const resolveActor =
  (deps: {
    externalAccounts: ExternalAccountRepository
  }): UseCase<ResolveActorInput, ResolveActorOutput, ResolveActorError> =>
  async (input) => {
    const actor = await deps.externalAccounts.findUserId(input.account)
    if (actor === undefined) return err({ kind: 'noAccount' })

    return ok({ actor })
  }

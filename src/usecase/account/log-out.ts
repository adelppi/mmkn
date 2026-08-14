import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * ログアウトする（`docs/domain/group.md`「ログアウトする」・`docs/features.md` #11）。
 *
 * **ここが持つのは前提条件（ログインしていること）の判定だけで、セッションは扱わない。**
 * 「以降の操作がどの User の操作でもなくなる」を実際に起こすのはセッションを持っている側であり、
 * **ユースケースは `UserId` を受け取るだけでセッションの存在を知らない**
 * （`docs/adr/0008-layer-internals.md`「セッションの読み取り」）。
 * 呼び出し側は、これが成功したときにセッションを終わらせる（`app/_lib/session.ts`）。
 *
 * **ログアウトは退会ではない**（`docs/features.md`「mmkn が持たないもの」）。
 * User も、Group・Member・記録も、連携している外部アカウントも、何一つ変わらない。
 */

export type LogOutInput = {
  readonly actor: UserId | undefined
}

export type LogOutError = { readonly kind: 'notAuthenticated' }

export const logOut =
  (deps: { users: UserRepository }): UseCase<LogOutInput, void, LogOutError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    // 操作する User が存在しなければ、その人はログインしていないのと同じ扱いになる
    // （`docs/domain/group.md`「前提条件を満たさなかったとき」の 1 行目）。
    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    return ok(undefined)
  }

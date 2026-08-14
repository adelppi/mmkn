import { Group, type JoinFailure } from '../../domain/group/group'
import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { IdGenerator } from '../port/id-generator'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * グループに参加する（`docs/domain/group.md`「グループに参加する」・`docs/features.md` #2）。
 */

export type JoinGroupInput = {
  readonly actor: UserId | undefined
  readonly inviteCode: string
  readonly displayName: string
}

/**
 * 失敗。参加コードに対応する Group が無い場合は「見つからない」として扱う
 * （`docs/domain/group.md`「前提条件を満たさなかったとき」）。
 *
 * **「その Group の Member でない」はここに現れない。** 参加は Member でない人が行う操作であり、
 * 前提条件が Member であることを求めていないため。
 */
export type JoinGroupError =
  | { readonly kind: 'notAuthenticated' }
  | { readonly kind: 'notFound' }
  | JoinFailure

export const joinGroup =
  (deps: {
    groups: GroupRepository
    users: UserRepository
    ids: IdGenerator
  }): UseCase<JoinGroupInput, Group, JoinGroupError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    const user = await deps.users.findById(input.actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    const group = await deps.groups.findByInviteCode(input.inviteCode)
    if (group === undefined) return err({ kind: 'notFound' })

    const joined = Group.join(group, {
      memberId: deps.ids.memberId(),
      user,
      displayName: input.displayName,
    })
    if (!joined.ok) return joined

    // **既に Member であれば、ドメインが Group をそのまま返す。** そのとき書き込むものは無く、
    // 入力された表示名も反映されない（`docs/domain/group.md`「グループに参加する」）。
    // 追加された Member だけが書き込まれることは、ポートの取り決め（`addMembers`）が保証する。
    await deps.groups.addMembers(joined.value)

    return ok(joined.value)
  }

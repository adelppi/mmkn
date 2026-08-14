import type { GroupAccessDenied } from '../../domain/group/access'
import { Group, type ChangeDisplayNameFailure } from '../../domain/group/group'
import { Member } from '../../domain/group/member'
import type { GroupId, MemberId, UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { UseCase } from '../usecase'
import { loadGroupAsMember } from './access'

/**
 * 表示名を変更する（`docs/domain/group.md`「表示名を変更する」・`docs/features.md` #3）。
 *
 * **同じ User の、他のグループの Member の表示名は変わらない。**
 * 過去の記録は Member を指しているため、記録側は書き換えない。
 */

export type ChangeDisplayNameInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  /** 表示名を変える Member。**操作する User 自身とは限らない。** */
  readonly member: MemberId
  readonly displayName: string
}

export type ChangeDisplayNameError = GroupAccessDenied | ChangeDisplayNameFailure

export const changeDisplayName =
  (deps: {
    groups: GroupRepository
  }): UseCase<ChangeDisplayNameInput, Group, ChangeDisplayNameError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const changed = Group.changeDisplayName(loaded.value.group, {
      member: input.member,
      displayName: input.displayName,
    })
    if (!changed.ok) return changed

    const renamed = Member.byId(changed.value.members, input.member)
    // ドメインが成功を返した時点でその Member は必ず存在する。
    // それでも握りつぶさず失敗として返す（`docs/domain/group.md`「前提条件を満たさなかったとき」）。
    if (renamed === undefined) return err({ kind: 'notMember' })

    // 1 人分だけを書き込む。他の Member を同時に書き換えると、
    // 2 人が同時に別の Member の表示名を変えたときに片方が消える。
    await deps.groups.saveDisplayName(renamed)

    return ok(changed.value)
  }

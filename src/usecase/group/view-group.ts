import type { GroupAccessDenied } from '../../domain/group/access'
import type { Group } from '../../domain/group/group'
import type { Member } from '../../domain/group/member'
import type { GroupId, UserId } from '../../domain/id'
import { ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { UseCase } from '../usecase'
import { loadGroupAsMember } from './access'

/**
 * Group の内容を見る（`docs/domain/group.md`「Group の属性」「Member の属性」）。
 *
 * **読み取りもユースケースを通す**（`docs/adr/0005-data-access-and-authorization.md`・
 * `docs/adr/0009-web-ui.md`）。表示のための取得も、リポジトリを直接呼ぶ経路を作らない。
 *
 * 前提条件は「操作する User が、その Group の Member であること」。
 * 参加コードもここから読めるため、**Member でない人に渡ることはない。**
 */

export type ViewGroupInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
}

export type ViewGroupOutput = {
  readonly group: Group
  /** 操作する User 自身の Member。表示名の変更が「自分の分」を指せるようにするために返す。 */
  readonly viewer: Member
}

export type ViewGroupError = GroupAccessDenied

export const viewGroup =
  (deps: { groups: GroupRepository }): UseCase<ViewGroupInput, ViewGroupOutput, ViewGroupError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    return ok({ group: loaded.value.group, viewer: loaded.value.member })
  }

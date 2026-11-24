import { requireGroupMember, type GroupAccessDenied } from '../../domain/group/access'
import type { Group } from '../../domain/group/group'
import type { Member } from '../../domain/group/member'
import type { GroupId, UserId } from '../../domain/id'
import { err, ok, type Result } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'

/**
 * Group を読み、操作する User がその Member であることを確かめる。
 *
 * **判定はドメイン層（`src/domain/group/access.ts`）が行い**、ここは結果を型に反映するだけである。
 */
export const loadGroupAsMember = async (
  groups: GroupRepository,
  id: GroupId,
  actor: UserId | undefined,
): Promise<Result<{ group: Group; member: Member }, GroupAccessDenied>> => {
  const group = await groups.findById(id)

  const access = requireGroupMember(group, actor)
  if (!access.ok) return access

  // `requireGroupMember` が通った時点で Group は存在する。
  // それでも握りつぶさず失敗として返す（`docs/domain/group.md`「前提条件を満たさなかったとき」）。
  if (group === undefined) return err({ kind: 'notFound' })

  return ok({ group, member: access.value })
}

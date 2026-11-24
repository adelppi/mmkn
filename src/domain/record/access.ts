import { requireMember, type GroupAccessDenied } from '../group/access'
import type { Group } from '../group/group'
import type { Member } from '../group/member'
import { idEquals, type GroupId, type UserId } from '../id'
import { err, type Result } from '../result'

/** 記録に対する操作の認可（`docs/domain/record.md`「記録の変更」）。 */

/** 記録がどのグループに属するか。Payment・Transfer に共通する。 */
type BelongsToGroup = { readonly groupId: GroupId }

/**
 * 操作する User が、その記録の属するグループの Member であることを確かめ、その Member を返す。
 *
 * 他のグループの記録を指した場合は「見つからない」になる（`docs/domain/record.md`「境界・例外ケース」）。
 */
export const requireRecordMember = (
  group: Group,
  record: BelongsToGroup | undefined,
  actor: UserId | undefined,
): Result<Member, GroupAccessDenied> => {
  if (actor === undefined) return err({ kind: 'notAuthenticated' })
  if (record === undefined || !idEquals(record.groupId, group.id)) return err({ kind: 'notFound' })

  return requireMember(group, actor)
}

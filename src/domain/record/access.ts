import { requireMember, type GroupAccessDenied } from '../group/access'
import type { Group } from '../group/group'
import type { Member } from '../group/member'
import { idEquals, type GroupId, type UserId } from '../id'
import { err, type Result } from '../result'

/**
 * 記録に対する操作の認可（`docs/domain/record.md`「記録の変更」）。
 *
 * 前提条件は「操作する User が、その記録の属するグループの Member であること」だけ。
 * **登録者は権限の判定に使わない**（`docs/domain/record.md`「登録者」）。
 * 他の Member が登録した記録も編集・削除できる。
 *
 * 理由の 3 区別の正は `docs/domain/group.md`「前提条件を満たさなかったとき」。
 */

/** 記録がどのグループに属するか。Payment・Transfer に共通する。 */
type BelongsToGroup = { readonly groupId: GroupId }

/**
 * 操作する User が、その記録の属するグループの Member であることを確かめ、その Member を返す。
 *
 * **他のグループの記録を指した場合は「見つからない」として扱う**
 * （`docs/domain/record.md`「境界・例外ケース」）。渡された Group に属さない記録は、
 * その操作者から見て存在しないのと同じ扱いになる。
 *
 * 未ログインを先に見るのは、対象の有無に依らず決まる理由だからである
 * （`src/domain/group/access.ts` と同じ順序）。
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

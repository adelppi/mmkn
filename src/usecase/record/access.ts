import type { GroupAccessDenied } from '../../domain/group/access'
import type { Group } from '../../domain/group/group'
import type { GroupId, UserId } from '../../domain/id'
import { requireRecordMember } from '../../domain/record/access'
import { err, ok, type Result } from '../../domain/result'
import type { Versioned } from '../usecase'

/**
 * 読んだ記録が、操作の対象として成立していることを確かめる。
 *
 * **判定はドメイン層（`src/domain/record/access.ts`）が行い**、ここは結果を型に反映するだけである。
 */
export const requireRecord = <T extends { readonly groupId: GroupId }>(
  group: Group,
  found: Versioned<T> | undefined,
  actor: UserId | undefined,
): Result<Versioned<T>, GroupAccessDenied> => {
  const access = requireRecordMember(group, found?.record, actor)
  if (!access.ok) return access

  // `requireRecordMember` が通った時点で記録は存在する。
  // それでも握りつぶさず失敗として返す（`docs/domain/group.md`「前提条件を満たさなかったとき」）。
  if (found === undefined) return err({ kind: 'notFound' })

  return ok(found)
}

/** 記録の更新・削除が、操作者の見ていた版で通らなかった（`docs/domain/record.md`「同じ記録に同時に手が入ったとき」）。 */
export type VersionConflict = { readonly kind: 'versionConflict' }

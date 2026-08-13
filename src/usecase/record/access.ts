import type { GroupAccessDenied } from '../../domain/group/access'
import type { Group } from '../../domain/group/group'
import type { GroupId, UserId } from '../../domain/id'
import { requireRecordMember } from '../../domain/record/access'
import { err, ok, type Result } from '../../domain/result'
import type { Versioned } from '../usecase'

/**
 * 読んだ記録が、操作の対象として成立していることを確かめる。
 *
 * **判定そのものはドメイン層（`src/domain/record/access.ts` の `requireRecordMember`）が行う。**
 * ここが持つのは、その結果を型に反映することだけ。
 *
 * 記録が読めなかった場合と、**他のグループの記録を指した場合**は、どちらも「見つからない」になる
 * （`docs/domain/record.md`「境界・例外ケース」）。
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

/**
 * 記録の更新・削除が、操作者の見ていた版で通らなかったことを表す失敗。
 *
 * **後から届いた変更は失敗し、失敗したことが操作者に伝わる**
 * （`docs/domain/record.md`「同じ記録に同時に手が入ったとき」）。
 * **自動でやり直さない**（`docs/adr/0005-data-access-and-authorization.md`）。
 */
export type VersionConflict = { readonly kind: 'versionConflict' }

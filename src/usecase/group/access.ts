import { requireGroupMember, type GroupAccessDenied } from '../../domain/group/access'
import type { Group } from '../../domain/group/group'
import type { Member } from '../../domain/group/member'
import type { GroupId, UserId } from '../../domain/id'
import { err, ok, type Result } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'

/**
 * Group を読み、操作する User がその Member であることを確かめる。
 *
 * **判定そのものはドメイン層（`src/domain/group/access.ts` の `requireGroupMember`）が行う。**
 * ここが持つのは読み込みと、その結果を型に反映することだけで、認可のルールは持たない
 * （`docs/adr/0005-data-access-and-authorization.md`「認可の置き場所」）。
 *
 * 「未ログイン」「存在しない」「Member でない」の 3 区別と、その優先順位は
 * `docs/domain/group.md`「前提条件を満たさなかったとき」を正とする。
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

import type { Group } from '../../domain/group/group'
import { Member } from '../../domain/group/member'
import type { User } from '../../domain/group/user'
import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * 参加コードが指すグループを、参加する前に見る（`docs/domain/group.md`「グループに参加する」）。
 *
 * **参加コードを持つ人には、グループ名と Member の表示名が見える。** 記録・収支・清算案の中身は
 * 含まない（`docs/domain/group.md`「前提条件を満たさなかったとき」の「起きないこと」）。
 *
 * 前提条件は「mmkn の User としてログインしていること」と「参加コードに対応する Group が
 * 存在すること」。**参加そのものは起きない**（それは `join-group.ts` の責務）。
 */

export type ViewInviteInput = {
  readonly actor: UserId | undefined
  readonly inviteCode: string
}

export type ViewInviteOutput = {
  readonly group: Group
  /** 操作する User。表示名の初期値に、その名前を使えるようにするために返す。 */
  readonly viewer: User
  /** **既に Member なら、参加は何も起こさない**（`docs/domain/group.md`「グループに参加する」）。 */
  readonly alreadyMember: boolean
}

export type ViewInviteError = { readonly kind: 'notAuthenticated' } | { readonly kind: 'notFound' }

export const viewInvite =
  (deps: { groups: GroupRepository; users: UserRepository }): UseCase<
    ViewInviteInput,
    ViewInviteOutput,
    ViewInviteError
  > =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    const viewer = await deps.users.findById(input.actor)
    if (viewer === undefined) return err({ kind: 'notAuthenticated' })

    const group = await deps.groups.findByInviteCode(input.inviteCode)
    if (group === undefined) return err({ kind: 'notFound' })

    return ok({
      group,
      viewer,
      alreadyMember: Member.byUser(group.members, viewer.id) !== undefined,
    })
  }

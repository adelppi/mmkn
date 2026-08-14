import { Group, type CreateGroupFailure } from '../../domain/group/group'
import type { UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { IdGenerator } from '../port/id-generator'
import type { InviteCodeGenerator } from '../port/invite-code-generator'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * グループを作成する（`docs/domain/group.md`「グループを作成する」・`docs/features.md` #1）。
 */

export type CreateGroupInput = {
  /** 操作する User。**セッションの存在は知らない**（`docs/adr/0008-layer-internals.md`）。 */
  readonly actor: UserId | undefined
  readonly name: string
  readonly defaultCurrency: string
}

/**
 * 失敗（`docs/adr/0008-layer-internals.md`：**ユースケースごとのタグ付き union**）。
 *
 * `inviteCodeUnavailable` は、参加コードの生成し直しを繰り返しても空きが見つからなかったことを表す。
 * cuid2 の 24 文字で現実には起きないが、**衝突は起きない前提にしない**（`docs/adr/0002`）以上、
 * 諦める場合を型に出しておく。
 */
export type CreateGroupError =
  | { readonly kind: 'notAuthenticated' }
  | CreateGroupFailure
  | { readonly kind: 'inviteCodeUnavailable' }

/** 参加コードが衝突したときに生成し直す回数の上限。 */
const INVITE_CODE_ATTEMPTS = 5

export const createGroup =
  (deps: {
    groups: GroupRepository
    users: UserRepository
    ids: IdGenerator
    inviteCodes: InviteCodeGenerator
  }): UseCase<CreateGroupInput, Group, CreateGroupError> =>
  async (input) => {
    if (input.actor === undefined) return err({ kind: 'notAuthenticated' })

    // 操作する User が存在しなければ、その人はログインしていないのと同じ扱いになる
    // （`docs/domain/group.md`「前提条件を満たさなかったとき」の 1 行目）。
    const creator = await deps.users.findById(input.actor)
    if (creator === undefined) return err({ kind: 'notAuthenticated' })

    const id = deps.ids.groupId()
    const creatorMemberId = deps.ids.memberId()

    for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt += 1) {
      const group = Group.create({
        id,
        name: input.name,
        defaultCurrency: input.defaultCurrency,
        inviteCode: deps.inviteCodes.next(),
        creator,
        creatorMemberId,
      })
      if (!group.ok) return group

      const outcome = await deps.groups.create(group.value)
      if (outcome.kind === 'created') return ok(group.value)
    }

    return err({ kind: 'inviteCodeUnavailable' })
  }

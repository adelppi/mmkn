import type {
  ListGroupsError,
  ListGroupsInput,
  ListGroupsOutput,
} from '../../../../usecase/group/list-groups'
import type { ReleasePlaceError, ReleasePlaceInput } from '../../../../usecase/group/release-place'
import type { UseCase } from '../../../../usecase/usecase'
import { resolveActor, type ContextUseCases, type DiscordContext } from '../../context'
import { toGroupChoicesReply, toReleasedReply } from '../../presenter/group'
import { denied, type Reply } from '../../presenter/reply'

/**
 * 場と Group の対応づけ・解除（`docs/features.md` #13・`docs/domain/group.md`）。
 *
 * **対応づけは参加ではない。** その場にいる人が Member になることはない。
 * **結果は実行者のみに返る**（`docs/adr/0006-discord-http-interactions.md`「返信の可視性」）。
 */

export type PlaceCommandUseCases = ContextUseCases & {
  readonly listGroups: UseCase<ListGroupsInput, ListGroupsOutput, ListGroupsError>
  readonly releasePlace: UseCase<ReleasePlaceInput, void, ReleasePlaceError>
}

/**
 * 対応づけるグループを選ばせる。
 *
 * **ここでは何も書き込まない。** 対応づけが起きるのは、選び終えた次の Interaction
 * （`controller/component/place.ts`）である。**選択をセレクト 1 回で確定させる**ため、
 * 保存すべき中間状態は発生しない（`docs/adr/0006`「ユーザー選択 UI」）。
 */
export const link =
  (deps: PlaceCommandUseCases) =>
  async (context: DiscordContext): Promise<Reply> => {
    const actor = await resolveActor(deps, context)
    if (!actor.ok) return actor.error

    const groups = await deps.listGroups({ actor: actor.value })
    if (!groups.ok) return denied(groups.error)

    return toGroupChoicesReply(groups.value)
  }

/**
 * 対応を解除する。
 *
 * 前提条件は「操作する User が、**その場に対応する Group** の Member であること」。
 * 対象の Group は入力に取らず、場から解決する（`docs/domain/group.md`）。
 */
export const unlink =
  (deps: PlaceCommandUseCases) =>
  async (context: DiscordContext): Promise<Reply> => {
    const actor = await resolveActor(deps, context)
    if (!actor.ok) return actor.error

    const released = await deps.releasePlace({ actor: actor.value, place: context.place })
    if (!released.ok) return denied(released.error)

    return toReleasedReply()
  }

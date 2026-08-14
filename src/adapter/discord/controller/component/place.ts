import type { PlaceMapping } from '../../../../domain/group/place-mapping'
import { toGroupId } from '../../../../domain/id'
import type { AssignPlaceError, AssignPlaceInput } from '../../../../usecase/group/assign-place'
import type {
  ViewGroupError,
  ViewGroupInput,
  ViewGroupOutput,
} from '../../../../usecase/group/view-group'
import type { UseCase } from '../../../../usecase/usecase'
import { resolveActor, type ContextUseCases, type DiscordContext } from '../../context'
import { toAssignedReply } from '../../presenter/group'
import { denied, notice, type Reply } from '../../presenter/reply'

/**
 * 場に Group を対応づける（`docs/domain/group.md`「場に Group を対応づける」）。
 *
 * **対応づけは参加ではない。** その場にいる人が Member になることはない。
 * その場に既に別の Group が対応していれば、**新しい対応で置き換える**（後勝ち）。
 */

export type AssignComponentUseCases = ContextUseCases & {
  readonly assignPlace: UseCase<AssignPlaceInput, PlaceMapping, AssignPlaceError>
  readonly viewGroup: UseCase<ViewGroupInput, ViewGroupOutput, ViewGroupError>
}

/**
 * どの Group を対応づけるかは、押した人が**この Interaction で選んだもの**である。
 *
 * 前提条件（その Group の Member であること）の判定はドメイン層にあり、
 * 選択肢に載っていたことを根拠にしない（`docs/adr/0005-data-access-and-authorization.md`）。
 */
const assignTo =
  (deps: AssignComponentUseCases) =>
  async (context: DiscordContext, groupId: string | undefined): Promise<Reply> => {
    if (groupId === undefined || groupId === '') {
      return notice('グループが選ばれていません', 'もう一度 `/mmkn link` からやり直してください。')
    }

    const actor = await resolveActor(deps, context)
    if (!actor.ok) return actor.error

    const assigned = await deps.assignPlace({
      actor: actor.value,
      place: context.place,
      group: toGroupId(groupId),
    })
    if (!assigned.ok) return denied(assigned.error)

    // **名前は対応づけたあとに読み直す。** メッセージに書いてあった名前は使わない
    // （`docs/adr/0006-discord-http-interactions.md`「メッセージに埋めた値を信じない」）。
    const viewed = await deps.viewGroup({ actor: actor.value, group: assigned.value.groupId })
    if (!viewed.ok) return denied(viewed.error)

    return toAssignedReply(viewed.value.group)
  }

/** `/mmkn link` が出したセレクトで選ばれたグループを対応づける。 */
export const pickGroup =
  (deps: AssignComponentUseCases) =>
  async (context: DiscordContext, values: readonly string[]): Promise<Reply> =>
    await assignTo(deps)(context, values[0])

/** グループを作った直後の「このチャンネルに対応づける」ボタン。 */
export const assign =
  (deps: AssignComponentUseCases) =>
  async (context: DiscordContext, args: readonly string[]): Promise<Reply> =>
    await assignTo(deps)(context, args[0])

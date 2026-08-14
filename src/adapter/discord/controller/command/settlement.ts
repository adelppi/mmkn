import type {
  ViewSettlementError,
  ViewSettlementInput,
  ViewSettlementOutput,
} from '../../../../usecase/settlement/view-settlement'
import type { UseCase } from '../../../../usecase/usecase'
import { resolveTarget, type ContextUseCases, type DiscordContext } from '../../context'
import { denied, type Reply } from '../../presenter/reply'
import { toBalanceReply, toSettlementReply } from '../../presenter/settlement'

/**
 * 収支・清算案を見る（`docs/features.md` #8・#9）。
 *
 * **どちらも保存しない。** 見るたびに、その時点で存在する記録から導出する
 * （`docs/domain/settlement.md`）。**返信は公開**（`docs/adr/0006`「返信の可視性」）。
 * グループ内のお金の動きは全員が把握している状態を目指すため。
 */

export type SettlementCommandUseCases = ContextUseCases & {
  readonly viewSettlement: UseCase<ViewSettlementInput, ViewSettlementOutput, ViewSettlementError>
}

const view =
  (deps: SettlementCommandUseCases, toReply: (output: ViewSettlementOutput) => Reply) =>
  async (context: DiscordContext): Promise<Reply> => {
    const target = await resolveTarget(deps, context)
    if (!target.ok) return target.error

    const viewed = await deps.viewSettlement({
      actor: target.value.actor,
      group: target.value.group,
    })
    if (!viewed.ok) return denied(viewed.error)

    return toReply(viewed.value)
  }

export const balance = (deps: SettlementCommandUseCases) => view(deps, toBalanceReply)

/** 清算案には「送金した」ボタンが付く（`controller/component/settle.ts`）。 */
export const settlement = (deps: SettlementCommandUseCases) =>
  view(deps, (output) => toSettlementReply(output))

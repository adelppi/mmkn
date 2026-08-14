import type { APIApplicationCommandInteractionDataOption } from 'discord-api-types/v10'
import type {
  ViewGroupError,
  ViewGroupInput,
  ViewGroupOutput,
} from '../../../../usecase/group/view-group'
import type { UseCase } from '../../../../usecase/usecase'
import { resolveTarget, type ContextUseCases, type DiscordContext } from '../../context'
import { CURRENCY_OPTION_NAME } from '../../definitions'
import { stringOption } from '../../payload'
import { toPaymentInputReply, toTransferInputReply } from '../../presenter/record'
import { denied, type Reply } from '../../presenter/reply'

/**
 * 支払い・送金の入力をひらく（`docs/features.md` #5・#6）。
 *
 * **ここは入力の 1 段目であり、何も書き込まない。** 返すのは、負担者・送り手・受け手の候補を
 * 載せた実行者のみの返信である。**候補を引くのはこの deferred の中だけ**で、
 * モーダルを開く次の Interaction では永続化に触れない
 * （`docs/adr/0006-discord-http-interactions.md`「負担者の選択とモーダルを直列にしない」）。
 */

export type RecordCommandUseCases = ContextUseCases & {
  readonly viewGroup: UseCase<ViewGroupInput, ViewGroupOutput, ViewGroupError>
}

/**
 * 使う通貨を決める。
 *
 * **引数が無ければグループの既定通貨を使う**（`docs/domain/group.md`「Group の属性」：
 * 既定通貨は入力の初期値であり、扱える通貨を制限しない）。
 *
 * **扱えるコードかどうかはここで見ない。** 判定はドメイン層にあり、記録が実際に作られる
 * ところで一度だけ行われる（`CLAUDE.md`：同じルールを 2 か所に書かない）。
 */
const currencyOf = (
  options: readonly APIApplicationCommandInteractionDataOption[],
  defaultCurrency: string,
): string => stringOption(options, CURRENCY_OPTION_NAME)?.trim() || defaultCurrency

const openInput =
  (deps: RecordCommandUseCases, toReply: typeof toPaymentInputReply) =>
  async (
    context: DiscordContext,
    options: readonly APIApplicationCommandInteractionDataOption[],
  ): Promise<Reply> => {
    const target = await resolveTarget(deps, context)
    if (!target.ok) return target.error

    const viewed = await deps.viewGroup({ actor: target.value.actor, group: target.value.group })
    if (!viewed.ok) return denied(viewed.error)

    return toReply({
      group: viewed.value.group,
      // 自分を既定で選んだ状態にするためだけに使う（`docs/adr/0006`「ユーザー選択 UI」）。
      viewerMemberId: viewed.value.viewer.id,
      currency: currencyOf(options, viewed.value.group.defaultCurrency),
      occurredOn: context.today,
    })
  }

export const openPaymentInput = (deps: RecordCommandUseCases) =>
  openInput(deps, toPaymentInputReply)

export const openTransferInput = (deps: RecordCommandUseCases) =>
  openInput(deps, toTransferInputReply)

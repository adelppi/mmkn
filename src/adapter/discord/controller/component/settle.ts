import { toMemberId } from '../../../../domain/id'
import type { Transfer } from '../../../../domain/record/transfer'
import type {
  ViewGroupError,
  ViewGroupInput,
  ViewGroupOutput,
} from '../../../../usecase/group/view-group'
import type {
  RegisterSettlementTransferError,
  RegisterSettlementTransferInput,
} from '../../../../usecase/settlement/register-settlement-transfer'
import type {
  ViewSettlementError,
  ViewSettlementInput,
  ViewSettlementOutput,
} from '../../../../usecase/settlement/view-settlement'
import type { UseCase, Versioned } from '../../../../usecase/usecase'
import { moneyText } from '../../../shared/money'
import { resolveTarget, type ContextUseCases, type DiscordContext } from '../../context'
import { messageOf } from '../../presenter/message'
import { denied, type Reply } from '../../presenter/reply'
import { toSettlementReply, type SettlementHeadline } from '../../presenter/settlement'

/**
 * 清算案の「送金した」（`docs/domain/settlement.md`「清算案の送金を記録する」・
 * `docs/adr/0006-discord-http-interactions.md`「メッセージコンポーネント」）。
 *
 * - **金額を入力に取らない。** 登録の時点で清算案を導出し直した額が使われる
 * - **送り手は押下者に固定する。** `custom_id` に載るのは受け手と通貨だけ
 * - **押下者の検査は必ず行う。** ボタンは全員に見えて全員が押せる。押した人がその Group の
 *   Member かどうかを見るのはこちら側の責務であり、判定はドメイン層にある
 * - **押した時点の清算案にその送金が無ければ、最新の清算案に描き直す。** 案内文を出すだけに
 *   しないのは、古いボタンが残って何度でも同じ失敗を踏めるため
 */

export type SettleUseCases = ContextUseCases & {
  readonly viewGroup: UseCase<ViewGroupInput, ViewGroupOutput, ViewGroupError>
  readonly viewSettlement: UseCase<ViewSettlementInput, ViewSettlementOutput, ViewSettlementError>
  readonly registerSettlementTransfer: UseCase<
    RegisterSettlementTransferInput,
    Versioned<Transfer>,
    RegisterSettlementTransferError
  >
}

/**
 * 押した結果の返し方。
 *
 * | | 何をするか | いつ |
 * |---|---|---|
 * | `replace` | 清算案のメッセージを最新に描き直す | 押下者が Member として解決できたとき |
 * | `aside` | **元のメッセージには触れず**、押下者だけに伝える | 解決できなかったとき |
 *
 * **`aside` が要るのは、清算案のメッセージが公開だからである。** Member でない人が押したことで
 * 全員の見ている清算案がエラーに差し替わると、押した人以外にとっては情報が消えたことになる。
 */
export type SettleOutcome =
  | { readonly kind: 'replace'; readonly reply: Reply }
  | { readonly kind: 'aside'; readonly reply: Reply }

const headlineOf = (
  result: Awaited<ReturnType<SettleUseCases['registerSettlementTransfer']>>,
): SettlementHeadline => {
  if (result.ok) {
    const { money } = result.value.record

    return {
      title: '送金を記録しました',
      // **記録された額は、押した画面に出ていた額とは限らない**（`docs/domain/settlement.md`）。
      // 実際に記録された額をそのまま伝える。
      description: moneyText(money.amount, money.currency).text,
      tone: 'done',
    }
  }

  return { title: '送金を記録しませんでした', description: messageOf(result.error), tone: 'denied' }
}

export const settle =
  (deps: SettleUseCases) =>
  async (context: DiscordContext, args: readonly string[]): Promise<SettleOutcome> => {
    const [recipient = '', currency = ''] = args

    const target = await resolveTarget(deps, context)
    if (!target.ok) return { kind: 'aside', reply: target.error }

    // **押下者の検査。** その Group の Member でなければ、ここで止まる。
    // 送り手にあたる Member もここで決まる（押下者に固定する）。
    const viewed = await deps.viewGroup({ actor: target.value.actor, group: target.value.group })
    if (!viewed.ok) return { kind: 'aside', reply: denied(viewed.error) }

    const registered = await deps.registerSettlementTransfer({
      actor: target.value.actor,
      group: target.value.group,
      sender: viewed.value.viewer.id,
      recipient: toMemberId(recipient),
      currency,
      /**
       * 発生日。**Discord は操作した人の手元の日付を伝えない**ため、サーバー側の日付になる
       * （`docs/domain/record.md`「発生日」・`context.ts` の `today`）。
       */
      occurredOn: context.today,
    })

    // **登録できてもできなくても、いまの清算案に描き直す**（`docs/adr/0006`）。
    // 送るお金が無くなればボタンも消えるため、古いボタンが残らない。
    const settlement = await deps.viewSettlement({
      actor: target.value.actor,
      group: target.value.group,
    })
    if (!settlement.ok) return { kind: 'aside', reply: denied(settlement.error) }

    return {
      kind: 'replace',
      reply: toSettlementReply(settlement.value, headlineOf(registered)),
    }
  }

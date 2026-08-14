import { toMemberId } from '../../../../domain/id'
import { currency as toCurrency } from '../../../../domain/money/currency'
import type { Payment } from '../../../../domain/record/payment'
import type { Transfer } from '../../../../domain/record/transfer'
import type {
  ViewGroupError,
  ViewGroupInput,
  ViewGroupOutput,
} from '../../../../usecase/group/view-group'
import type {
  RegisterPaymentError,
  RegisterPaymentInput,
} from '../../../../usecase/record/register-payment'
import type {
  RegisterTransferError,
  RegisterTransferInput,
} from '../../../../usecase/record/register-transfer'
import type { UseCase, Versioned } from '../../../../usecase/usecase'
import { parseAmount } from '../../../shared/money'
import { resolveTarget, type ContextUseCases, type DiscordContext } from '../../context'
import { FIELD } from '../../definitions'
import type { ModalValues } from '../../payload'
import { denied, type Reply } from '../../presenter/reply'
import { toPaymentReply, toTransferReply } from '../../presenter/record'

/**
 * モーダルで入力された記録を登録する（`docs/features.md` #5・#6）。
 *
 * **入力の変換だけを行う。** 支払者と負担者の関係も、金額の上限も、発生日の妥当性も見ない。
 * すべてドメイン層が判定し、失敗はそのまま文言になる（`src/adapter/web/controller/record.ts` と同じ形）。
 *
 * **対象の Group は場から解決する**（`docs/adr/0006-discord-http-interactions.md`）。
 * モーダルの `custom_id` に載っているのは通貨だけで、書き込みの対象を運んではいない。
 */

export type RecordModalUseCases = ContextUseCases & {
  readonly viewGroup: UseCase<ViewGroupInput, ViewGroupOutput, ViewGroupError>
  readonly registerPayment: UseCase<RegisterPaymentInput, Versioned<Payment>, RegisterPaymentError>
  readonly registerTransfer: UseCase<
    RegisterTransferInput,
    Versioned<Transfer>,
    RegisterTransferError
  >
}

/**
 * 打たれた金額を、その通貨の最小単位を 1 とした整数にする。
 *
 * **読めなかったものを 0 で埋めない。** `NaN` のまま渡し、ドメイン層に「金額として成立しない」と
 * 判定させる（`docs/domain/money.md`「金額の表し方」）。**扱えない通貨もここでは弾かない。**
 */
const amountOf = (raw: string, code: string): number => {
  const known = toCurrency(code)
  if (!known.ok) return Number.NaN

  return parseAmount(raw, known.value) ?? Number.NaN
}

/**
 * 記録できたあとの表示に使う Group を読む。
 *
 * **読めなくても記録は成立している。** そのときは名前の出ない形で結果を返し、
 * 「実行できませんでした」とは言わない（`presenter/record.ts` の `nameOf`）。
 */
const groupForDisplay = async (
  deps: RecordModalUseCases,
  input: ViewGroupInput,
): Promise<ViewGroupOutput['group'] | undefined> => {
  const viewed = await deps.viewGroup(input)
  return viewed.ok ? viewed.value.group : undefined
}

export const registerPayment =
  (deps: RecordModalUseCases) =>
  async (
    context: DiscordContext,
    values: ModalValues,
    args: readonly string[],
  ): Promise<Reply> => {
    const [currency = ''] = args

    const target = await resolveTarget(deps, context)
    if (!target.ok) return target.error

    const registered = await deps.registerPayment({
      actor: target.value.actor,
      group: target.value.group,
      payer: toMemberId(values.list(FIELD.payer)[0] ?? ''),
      bearers: values.list(FIELD.bearers).map(toMemberId),
      amount: amountOf(values.text(FIELD.amount), currency),
      currency,
      occurredOn: values.text(FIELD.occurredOn),
      description: values.text(FIELD.description),
    })
    if (!registered.ok) return denied(registered.error)

    const group = await groupForDisplay(deps, {
      actor: target.value.actor,
      group: target.value.group,
    })

    return toPaymentReply(group, registered.value.record)
  }

export const registerTransfer =
  (deps: RecordModalUseCases) =>
  async (
    context: DiscordContext,
    values: ModalValues,
    args: readonly string[],
  ): Promise<Reply> => {
    const [currency = ''] = args

    const target = await resolveTarget(deps, context)
    if (!target.ok) return target.error

    const registered = await deps.registerTransfer({
      actor: target.value.actor,
      group: target.value.group,
      sender: toMemberId(values.list(FIELD.sender)[0] ?? ''),
      recipient: toMemberId(values.list(FIELD.recipient)[0] ?? ''),
      amount: amountOf(values.text(FIELD.amount), currency),
      currency,
      occurredOn: values.text(FIELD.occurredOn),
    })
    if (!registered.ok) return denied(registered.error)

    const group = await groupForDisplay(deps, {
      actor: target.value.actor,
      group: target.value.group,
    })

    return toTransferReply(group, registered.value.record)
  }

import { toGroupId, toMemberId, toPaymentId, toUserId } from '../../../domain/id'
import { memberOrder } from '../../../domain/record/share'
import type { Payment } from '../../../domain/record/payment'
import { toMoney, toPlainDate } from './value'

/**
 * `payments` / `payment_bearers` の行と `Payment` 集約の変換。
 *
 * **行の形をここで明示的に宣言する**（理由は `mapper/user.ts` と同じ）。
 * **負担額は保存も復元もしない。** 金額と負担者から導出する（`docs/domain/record.md`「負担額の配分」）。
 */

export type PaymentRow = {
  readonly id: string
  readonly groupId: string
  readonly payerMemberId: string
  readonly amount: number
  readonly currency: string
  readonly occurredOn: string
  readonly description: string
  readonly recordedBy: string
  readonly recordedAt: Date
}

export type PaymentBearerRow = {
  readonly paymentId: string
  readonly memberId: string
}

export const toPayment = (row: PaymentRow, bearers: readonly PaymentBearerRow[]): Payment => ({
  id: toPaymentId(row.id),
  groupId: toGroupId(row.groupId),
  payer: toMemberId(row.payerMemberId),
  // 負担者は集合であり、行の並びは意味を持たない。ドメインが保つ配分順序に正規化して戻す
  // （`src/domain/record/payment.ts`：同じ負担者を別の順番で入力しても同じ Payment になる）。
  bearers: bearers.map((bearer) => toMemberId(bearer.memberId)).sort(memberOrder),
  money: toMoney(row.amount, row.currency),
  occurredOn: toPlainDate(row.occurredOn),
  description: row.description,
  recordedBy: toUserId(row.recordedBy),
  recordedAt: row.recordedAt,
})

export const fromPayment = (payment: Payment): PaymentRow => ({
  id: payment.id,
  groupId: payment.groupId,
  payerMemberId: payment.payer,
  amount: payment.money.amount,
  currency: payment.money.currency,
  occurredOn: payment.occurredOn,
  description: payment.description,
  recordedBy: payment.recordedBy,
  recordedAt: payment.recordedAt,
})

export const fromPaymentBearers = (payment: Payment): readonly PaymentBearerRow[] =>
  payment.bearers.map((bearer) => ({ paymentId: payment.id, memberId: bearer }))

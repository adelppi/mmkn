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

/**
 * 版を持つ Payment の行。
 *
 * **版はドメインのエンティティに持たせない**（`docs/adr/0005`「同時書き込みの競合」）ため、
 * 行の側にだけ現れ、`Payment` とは別に受け渡す。
 */
export type VersionedPaymentRow = PaymentRow & { readonly version: number }

/**
 * Payment 1 件と負担者 1 件を並べた行。**負担者の行が無い Payment では負担者側が null になる**
 * （外部結合で読むため）。
 */
export type PaymentWithBearerRow = {
  readonly payment: VersionedPaymentRow
  readonly bearer: PaymentBearerRow | null
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

/**
 * 結合して読んだ行を、Payment ごとにたたみ直す。版は行の側から一緒に返す。
 *
 * 1 件の Payment は負担者の数だけ行に展開されるため、Payment の識別子でまとめ直す。
 * **負担者の行が無い Payment も落とさない。**
 *
 * **並び順はここでは決めない**（`docs/domain/record.md`「記録の並び」がドメインの規則として持つ）。
 */
export const toPayments = (
  rows: readonly PaymentWithBearerRow[],
): readonly { readonly payment: Payment; readonly version: number }[] => {
  const folded = new Map<
    string,
    { readonly row: VersionedPaymentRow; readonly bearers: PaymentBearerRow[] }
  >()

  for (const { payment, bearer } of rows) {
    const bucket = folded.get(payment.id) ?? { row: payment, bearers: [] }
    if (bearer !== null) bucket.bearers.push(bearer)
    folded.set(payment.id, bucket)
  }

  return [...folded.values()].map(({ row, bearers }) => ({
    payment: toPayment(row, bearers),
    version: row.version,
  }))
}

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

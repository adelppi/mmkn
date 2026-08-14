import type { GroupAccessDenied } from '../../domain/group/access'
import type { GroupId, MemberId, UserId } from '../../domain/id'
import { Payment, type CreatePaymentFailure } from '../../domain/record/payment'
import { ok } from '../../domain/result'
import type { Clock } from '../port/clock'
import type { GroupRepository } from '../port/group-repository'
import type { IdGenerator } from '../port/id-generator'
import type { PaymentRepository } from '../port/payment-repository'
import type { UseCase, Versioned } from '../usecase'
import { loadGroupAsMember } from '../group/access'

/**
 * 支払いを記録する（`docs/domain/record.md`「Payment（支払い）」・`docs/features.md` #5）。
 */

export type RegisterPaymentInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  readonly payer: MemberId
  readonly bearers: readonly MemberId[]
  /** その通貨の最小単位を 1 とした値（`docs/domain/money.md`）。 */
  readonly amount: number
  readonly currency: string
  /** `YYYY-MM-DD`。**入力された日付をそのまま保持する**（`docs/domain/record.md`「発生日」）。 */
  readonly occurredOn: string
  /** 内容。**空でもよい。** */
  readonly description: string
}

export type RegisterPaymentError = GroupAccessDenied | CreatePaymentFailure

export const registerPayment =
  (deps: {
    payments: PaymentRepository
    groups: GroupRepository
    ids: IdGenerator
    clock: Clock
  }): UseCase<RegisterPaymentInput, Versioned<Payment>, RegisterPaymentError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const payment = Payment.create({
      id: deps.ids.paymentId(),
      group: loaded.value.group,
      payer: input.payer,
      bearers: input.bearers,
      amount: input.amount,
      currency: input.currency,
      occurredOn: input.occurredOn,
      description: input.description,
      // 登録者は Member ではなく User（`docs/domain/record.md`「登録者」）。
      // **支払者とは別のもの**であり、権限・計算・編集可否のいずれにも使わない。
      recordedBy: loaded.value.member.userId,
      recordedAt: deps.clock.now(),
    })
    if (!payment.ok) return payment

    const version = await deps.payments.create(payment.value)

    return ok({ record: payment.value, version })
  }

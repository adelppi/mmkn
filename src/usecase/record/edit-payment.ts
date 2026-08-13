import type { GroupId, MemberId, PaymentId, UserId } from '../../domain/id'
import { Payment, type EditPaymentFailure } from '../../domain/record/payment'
import { err, ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { PaymentRepository } from '../port/payment-repository'
import type { UseCase, Version, Versioned } from '../usecase'
import { loadGroupAsMember } from '../group/access'
import { requireRecord, type VersionConflict } from './access'

/**
 * 支払いを編集する（`docs/domain/record.md`「編集」・`docs/features.md` #7）。
 *
 * **グループの Member であれば、他の Member が登録した記録も編集できる。**
 * 編集できる属性はすべて渡す。**編集前の内容は残らない。**
 * **登録日時は取り直さない**ため、一覧での位置は動かない。
 */

export type EditPaymentInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  readonly payment: PaymentId
  /** 操作者が見ていた版。これが変わっていれば編集は失敗する。 */
  readonly version: Version
  readonly payer: MemberId
  readonly bearers: readonly MemberId[]
  readonly amount: number
  readonly currency: string
  readonly occurredOn: string
  readonly description: string
}

export type EditPaymentError = EditPaymentFailure | VersionConflict

export const editPayment =
  (deps: {
    payments: PaymentRepository
    groups: GroupRepository
  }): UseCase<EditPaymentInput, Versioned<Payment>, EditPaymentError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const found = await deps.payments.find(input.payment)
    const target = requireRecord(loaded.value.group, found, input.actor)
    if (!target.ok) return target

    const edited = Payment.edit(target.value.record, {
      group: loaded.value.group,
      actor: input.actor,
      payer: input.payer,
      bearers: input.bearers,
      amount: input.amount,
      currency: input.currency,
      occurredOn: input.occurredOn,
      description: input.description,
    })
    if (!edited.ok) return edited

    // **操作者が見ていた版で書き込む。** 読み直した版ではない。
    // 読み直して再試行すると、操作者が見ていない内容に変更を適用することになる（`docs/adr/0005`）。
    const written = await deps.payments.update(edited.value, input.version)
    if (written.kind === 'stale') return err({ kind: 'versionConflict' })

    return ok({ record: edited.value, version: written.version })
  }

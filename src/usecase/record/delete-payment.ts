import type { GroupAccessDenied } from '../../domain/group/access'
import type { GroupId, PaymentId, UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { PaymentRepository } from '../port/payment-repository'
import type { UseCase, Version } from '../usecase'
import { loadGroupAsMember } from '../group/access'
import { requireRecord, type VersionConflict } from './access'

/**
 * 支払いを削除する（`docs/domain/record.md`「削除」・`docs/features.md` #7）。
 *
 * **その記録は完全に存在しなくなる。削除履歴を残さず、復元もできない。**
 *
 * ドメインに `Payment.delete` が無いのは、削除が状態の遷移を持たないためである
 * （`src/domain/record/payment.ts`）。ドメインが担うのは認可の判定だけで、それは `requireRecord`
 * を通してここから呼ばれる。
 */

export type DeletePaymentInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  readonly payment: PaymentId
  /** 操作者が見ていた版。これが変わっていれば削除は失敗する。 */
  readonly version: Version
}

export type DeletePaymentError = GroupAccessDenied | VersionConflict

export const deletePayment =
  (deps: {
    payments: PaymentRepository
    groups: GroupRepository
  }): UseCase<DeletePaymentInput, void, DeletePaymentError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const found = await deps.payments.find(input.payment)
    const target = requireRecord(loaded.value.group, found, input.actor)
    if (!target.ok) return target

    const removed = await deps.payments.remove(input.payment, input.version)
    if (removed.kind === 'stale') return err({ kind: 'versionConflict' })

    return ok(undefined)
  }

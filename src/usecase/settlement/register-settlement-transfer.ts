import type { GroupAccessDenied } from '../../domain/group/access'
import type { GroupId, MemberId, UserId } from '../../domain/id'
import { currency as toCurrency, type CurrencyUnsupported } from '../../domain/money/currency'
import { Transfer, type CreateTransferFailure } from '../../domain/record/transfer'
import { ok } from '../../domain/result'
import { balancesOf } from '../../domain/settlement/balance'
import {
  settle,
  settlementTransferOf,
  type SettlementChanged,
} from '../../domain/settlement/settlement'
import type { Clock } from '../port/clock'
import type { GroupRepository } from '../port/group-repository'
import type { IdGenerator } from '../port/id-generator'
import type { PaymentRepository } from '../port/payment-repository'
import type { TransferRepository } from '../port/transfer-repository'
import type { UseCase, Versioned } from '../usecase'
import { loadGroupAsMember } from '../group/access'

/** 清算案の送金を記録する（`docs/domain/settlement.md`「清算案の送金を記録する」・`docs/features.md` #10）。 */

export type RegisterSettlementTransferInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  readonly sender: MemberId
  readonly recipient: MemberId
  readonly currency: string
  /** 発生日。**金額と違い、これは入力で受け取る**（`docs/domain/record.md`「発生日」）。 */
  readonly occurredOn: string
}

export type RegisterSettlementTransferError =
  | GroupAccessDenied
  | CurrencyUnsupported
  | SettlementChanged
  | CreateTransferFailure

export const registerSettlementTransfer =
  (deps: {
    payments: PaymentRepository
    transfers: TransferRepository
    groups: GroupRepository
    ids: IdGenerator
    clock: Clock
  }): UseCase<
    RegisterSettlementTransferInput,
    Versioned<Transfer>,
    RegisterSettlementTransferError
  > =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const currency = toCurrency(input.currency)
    if (!currency.ok) return currency

    const [payments, transfers] = await Promise.all([
      deps.payments.listByGroup(input.group),
      deps.transfers.listByGroup(input.group),
    ])

    // **登録の時点で導出し直す。** 画面に表示された時点の金額は使わない。
    const settlements = balancesOf({
      payments: payments.map((it) => it.record),
      transfers: transfers.map((it) => it.record),
    }).map(settle)

    const settlementTransfer = settlementTransferOf(settlements, {
      currency: currency.value,
      sender: input.sender,
      recipient: input.recipient,
    })
    if (!settlementTransfer.ok) return settlementTransfer

    const transfer = Transfer.create({
      id: deps.ids.transferId(),
      group: loaded.value.group,
      sender: input.sender,
      recipient: input.recipient,
      amount: settlementTransfer.value.amount,
      currency: input.currency,
      occurredOn: input.occurredOn,
      recordedBy: loaded.value.member.userId,
      recordedAt: deps.clock.now(),
    })
    if (!transfer.ok) return transfer

    const version = await deps.transfers.create(transfer.value)

    return ok({ record: transfer.value, version })
  }

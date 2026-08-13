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

/**
 * 清算案の送金を記録する（`docs/domain/settlement.md`「清算案の送金を記録する」・
 * `docs/features.md` #10）。
 *
 * **金額を入力に取らない。** その時点の記録から清算案を導出し直し、示されている額をそのまま使う。
 * 表示から登録までの間に記録が変わっていれば、登録される金額は表示された額と異なる。
 *
 * **その時点の清算案にその送金が含まれていなければ、Transfer は登録されず、
 * 清算案が変わったことが操作者に伝わる**（`settlementChanged`）。
 *
 * できあがる Transfer は、手で入力したものと区別されない（`register-transfer.ts`）。
 */

export type RegisterSettlementTransferInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  readonly sender: MemberId
  readonly recipient: MemberId
  readonly currency: string
  /**
   * 発生日。**金額と違い、これは入力で受け取る。**
   *
   * ドメインは発生日にタイムゾーンを持たせず、「今日」がどの日付かを決めない
   * （`docs/domain/record.md`「発生日」）。操作した本人の手元で「今日」にあたる日付を決めるのは
   * 入口の責務であり、ユースケースはそれをそのまま保持する。
   */
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

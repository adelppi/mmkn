import type { GroupAccessDenied } from '../../domain/group/access'
import type { Group } from '../../domain/group/group'
import type { GroupId, UserId } from '../../domain/id'
import { ok } from '../../domain/result'
import { balancesOf, type CurrencyBalances } from '../../domain/settlement/balance'
import { settle, type Settlement } from '../../domain/settlement/settlement'
import type { GroupRepository } from '../port/group-repository'
import type { PaymentRepository } from '../port/payment-repository'
import type { TransferRepository } from '../port/transfer-repository'
import type { UseCase } from '../usecase'
import { loadGroupAsMember } from '../group/access'

/**
 * 収支・清算案を見る（`docs/domain/settlement.md`「収支・清算案を見る」・
 * `docs/features.md` #8・#9）。
 *
 * **どちらも保存しない。** 導出するたびに、その時点で存在する記録から計算する。
 * 導出した結果を次回のために残すこともしない。
 *
 * **Member でない人に、収支・清算案の中身は見えない**（`docs/domain/settlement.md`）。
 */

export type ViewSettlementInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
}

export type ViewSettlementOutput = {
  readonly group: Group
  /** 通貨ごとの Member の収支。**記録が存在する通貨についてのみ現れる。** */
  readonly balances: readonly CurrencyBalances[]
  /** 通貨ごとの清算案。`balances` と同じ通貨が同じ並びで現れる。 */
  readonly settlements: readonly Settlement[]
}

export type ViewSettlementError = GroupAccessDenied

export const viewSettlement =
  (deps: {
    payments: PaymentRepository
    transfers: TransferRepository
    groups: GroupRepository
  }): UseCase<ViewSettlementInput, ViewSettlementOutput, ViewSettlementError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const [payments, transfers] = await Promise.all([
      deps.payments.listByGroup(input.group),
      deps.transfers.listByGroup(input.group),
    ])

    const balances = balancesOf({
      payments: payments.map((it) => it.record),
      transfers: transfers.map((it) => it.record),
    })

    // 清算案は収支から導く。同じ収支を 2 度計算しないよう、ここで受け渡す。
    const settlements = balances.map(settle)

    return ok({ group: loaded.value.group, balances, settlements })
  }

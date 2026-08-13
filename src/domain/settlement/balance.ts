import type { MemberId } from '../id'
import type { Currency } from '../money/currency'
import { Payment } from '../record/payment'
import { memberOrder } from '../record/share'
import type { Transfer } from '../record/transfer'

/**
 * 収支（`docs/domain/settlement.md`「収支」）。
 *
 * **保存しない。** 導出するたびに、その時点で存在する記録から計算する。
 * **通貨ごとに独立して計算する**（`docs/domain/money.md`「通貨をまたがない」）。
 */

/** ある Member の、ある通貨についての過不足。正なら受け取る側、負なら支払う側、0 なら過不足なし。 */
export type Balance = {
  readonly member: MemberId
  /** その通貨の最小単位を 1 とした値。**記録 1 件の上限は、収支には効かない**（`docs/domain/money.md`）。 */
  readonly amount: number
}

/** 1 つの通貨についての、Member ごとの収支。 */
export type CurrencyBalances = {
  readonly currency: Currency
  /** 配分順序（`src/domain/record/share.ts`）で並ぶ。合計は必ず 0 になる。 */
  readonly balances: readonly Balance[]
}

/** 導出の材料。**現在存在する Payment / Transfer だけを考慮する。** */
export type Records = {
  readonly payments: readonly Payment[]
  readonly transfers: readonly Transfer[]
}

type Ledger = Map<Currency, Map<MemberId, number>>

const move = (ledger: Ledger, currency: Currency, member: MemberId, amount: number): void => {
  const perCurrency = ledger.get(currency) ?? new Map<MemberId, number>()
  perCurrency.set(member, (perCurrency.get(member) ?? 0) + amount)
  ledger.set(currency, perCurrency)
}

/**
 * 記録から収支を導出する。
 *
 * - Payment … 支払者は金額の分だけプラス、負担者は負担額の分だけマイナス
 * - Transfer … 送り手は金額の分だけプラス、受け手は金額の分だけマイナス
 *
 * **お金を出した側がプラスになる**という 1 つの見方で、どちらの記録も揃っている。
 * 正が「受け取る側」、負が「支払う側」を意味するのはこのため
 * （`docs/domain/settlement.md`「収支の意味」）。
 *
 * **発生日は使わない**（`docs/domain/record.md`「発生日」）。未来の日付の記録も、
 * 日付が来るのを待たずにそのまま収支に入る。
 *
 * **記録が存在する通貨についてのみ導出する**（`docs/domain/settlement.md`「境界・例外ケース」）。
 * 現れるのはその通貨の記録に登場した Member だけで、収支が 0 になった Member も落とさない。
 */
export const balancesOf = (records: Records): readonly CurrencyBalances[] => {
  const ledger: Ledger = new Map()

  for (const payment of records.payments) {
    const { amount, currency } = payment.money
    move(ledger, currency, payment.payer, amount)

    // 負担額の配分ルールの正は `docs/domain/record.md`。ここでは導出結果を使うだけ。
    for (const share of Payment.shares(payment)) {
      move(ledger, currency, share.bearer, -share.amount)
    }
  }

  for (const transfer of records.transfers) {
    const { amount, currency } = transfer.money
    move(ledger, currency, transfer.sender, amount)
    move(ledger, currency, transfer.recipient, -amount)
  }

  return [...ledger.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([currency, perCurrency]) => ({
      currency,
      balances: [...perCurrency.entries()]
        .map(([member, amount]) => ({ member, amount }))
        .sort((a, b) => memberOrder(a.member, b.member)),
    }))
}

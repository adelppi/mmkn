import { idEquals, type MemberId } from '../id'
import type { Currency } from '../money/currency'
import { memberOrder } from '../record/share'
import { err, ok, type Result } from '../result'
import { balancesOf, type Balance, type CurrencyBalances, type Records } from './balance'

/** 清算案（`docs/domain/settlement.md`「清算案」）。求め方は `docs/adr/0001-settlement-greedy.md`。 */

/** 清算案が示す「A から B へ n」。**記録された送金（`Transfer`）とは別のもの。** */
export type SettlementTransfer = {
  readonly sender: MemberId
  readonly recipient: MemberId
  readonly amount: number
}

/** 1 つの通貨についての清算案。**通貨ごとに独立して生成する。** */
export type Settlement = {
  readonly currency: Currency
  readonly transfers: readonly SettlementTransfer[]
}

/** 押した時点の清算案に、その送金が含まれていなかった（`docs/domain/settlement.md`）。 */
export type SettlementChanged = { kind: 'settlementChanged' }

/**
 * 1 つの通貨の収支から清算案を導出する（`docs/adr/0001-settlement-greedy.md`）。
 *
 * 同じ収支で選択が割れる場合は、配分順序（`src/domain/record/share.ts`）の先頭を選ぶ。
 * 1 回の繰り返しで必ず 1 人以上が対象から外れるため、n 人なら送金は n-1 件以下に収まる。
 */
export const settle = ({ currency, balances }: CurrencyBalances): Settlement => {
  // 選択が割れたときに先頭が決まるよう、あらかじめ配分順序で並べておく。
  let remaining: readonly Balance[] = balances
    .filter((balance) => balance.amount !== 0)
    .slice()
    .sort((a, b) => memberOrder(a.member, b.member))

  const transfers: SettlementTransfer[] = []

  while (remaining.length > 0) {
    const first = remaining[0]
    if (first === undefined) break

    const debtor = remaining.reduce((min, x) => (x.amount < min.amount ? x : min), first)
    const creditor = remaining.reduce((max, x) => (x.amount > max.amount ? x : max), first)

    // 収支の合計は必ず 0 になる（`docs/domain/settlement.md`「収支の性質」）ため、
    // 0 でない Member が残っていればマイナス側とプラス側が必ず両方いる。
    // それでも、合計が 0 でない収支を渡されたときに回り続けないよう明示的に止める。
    if (debtor.amount >= 0 || creditor.amount <= 0) break

    const amount = Math.min(-debtor.amount, creditor.amount)
    transfers.push({ sender: debtor.member, recipient: creditor.member, amount })

    // 小さいほうを送金額にしているため、差し引いてもプラス側が負に転じることはない。
    remaining = remaining
      .map((balance) => {
        if (idEquals(balance.member, debtor.member)) {
          return { ...balance, amount: balance.amount + amount }
        }
        if (idEquals(balance.member, creditor.member)) {
          return { ...balance, amount: balance.amount - amount }
        }
        return balance
      })
      .filter((balance) => balance.amount !== 0)
  }

  return { currency, transfers }
}

/** 記録から、通貨ごとの清算案を導出する。すべて 0 の通貨も、空の清算案として結果に残る。 */
export const settlementsOf = (records: Records): readonly Settlement[] =>
  balancesOf(records).map(settle)

/**
 * 清算案が示す送金額を取り出す（`docs/domain/settlement.md`「清算案の送金を記録する」）。
 *
 * 清算案にその送金が無ければ失敗を返す。
 */
export const settlementTransferOf = (
  settlements: readonly Settlement[],
  input: { currency: Currency; sender: MemberId; recipient: MemberId },
): Result<SettlementTransfer, SettlementChanged> => {
  const settlement = settlements.find((it) => it.currency === input.currency)

  const transfer = settlement?.transfers.find(
    (it) => idEquals(it.sender, input.sender) && idEquals(it.recipient, input.recipient),
  )
  if (transfer === undefined) return err({ kind: 'settlementChanged' })

  return ok(transfer)
}

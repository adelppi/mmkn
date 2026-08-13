import { idEquals, type MemberId } from '../id'
import type { Currency } from '../money/currency'
import { memberOrder } from '../record/share'
import { err, ok, type Result } from '../result'
import { balancesOf, type Balance, type CurrencyBalances, type Records } from './balance'

/**
 * 清算案（`docs/domain/settlement.md`「清算案」）。
 *
 * **現在の収支を 0 にするために、誰から誰へいくら送るか**を表す。
 * **保存しない。確定もしない。** 過去の清算案は存在せず、Transfer とも紐付かない。
 *
 * 求め方は `docs/adr/0001-settlement-greedy.md`（貪欲法）。
 * **送金件数はできるだけ少なくするが、常に最小であることは保証しない。**
 */

/**
 * 清算案が示す「A から B へ n」（`docs/glossary.md` の `settlementTransfer`）。
 *
 * **記録された送金（`Transfer`）とは別のもの。** これがひとりでに Transfer になることはない。
 * ユーザーが Transfer を登録して初めて記録になり、収支に反映される。
 */
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
 * 収支が 0 でない Member だけを対象に、次を繰り返す。
 *
 * 1. 収支が最も小さい Member と、最も大きい Member を 1 人ずつ選ぶ
 * 2. 両者の収支の絶対値のうち小さいほうを送金額とし、「マイナス側 → プラス側」の送金を 1 件作る
 * 3. 両者の収支からその額を差し引き、0 になった Member を対象から外す
 *
 * 同じ収支で選択が割れる場合は、配分順序（`src/domain/record/share.ts`）の先頭を選ぶ。
 * **同じ記録の集合からは、何度導出しても同じ清算案が得られる。**
 *
 * 1 回の繰り返しで必ず 1 人以上が対象から外れるため、収支が 0 でない Member が n 人なら
 * 送金は n-1 件以下に収まる。**件数が厳密な最小になるとは限らない。**
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

/**
 * 記録から、通貨ごとの清算案を導出する。
 *
 * **記録が存在する通貨についてのみ導出する。** ある通貨の収支がすべて 0 なら、
 * その通貨の清算案は空になる（通貨そのものは結果に残る）。
 */
export const settlementsOf = (records: Records): readonly Settlement[] =>
  balancesOf(records).map(settle)

/**
 * 清算案が示す送金額を取り出す（`docs/domain/settlement.md`「清算案の送金を記録する」）。
 *
 * **金額は入力させず、その時点の記録から導出し直した額を使う。** 表示から登録までの間に
 * 記録が変わっていれば、ここで返る額は表示された額と異なる。
 *
 * その送り手から受け手への、その通貨の送金が清算案に無ければ**失敗を返す**。
 * 金額を入力しない導線である以上、案に無ければ登録すべき額が存在しない。
 * **部分的な額を登録することはできない**（それをしたい場合は、金額を入力して Transfer を登録する）。
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

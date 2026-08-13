import { err, ok, type Result } from '../result'
import { currency as toCurrency, type Currency, type CurrencyUnsupported } from './currency'

/**
 * 金額（`docs/domain/money.md`「金額の表し方」）。
 *
 * **「整数 + 通貨」であり、浮動小数点数は使わない。** 整数は、その通貨の最小単位を 1 とした値。
 */
export type Money = {
  /** その通貨の最小単位を 1 とした値。正の整数。 */
  readonly amount: number
  readonly currency: Currency
}

/**
 * 1 件の記録の金額の上限（`docs/domain/money.md`「金額の上限」）。その通貨の最小単位で 10 億。
 *
 * **上限は 1 件ごとに見る。** 収支や記録の合計には上限を設けない。
 * **この数値をここ以外に書かない**（`CLAUDE.md`）。画面側の入力属性もここから取る。
 */
export const MONEY_MAX_AMOUNT = 1_000_000_000

/** 金額が制約を満たさなかったときの失敗。 */
export type AmountInvalid = { kind: 'amountNotPositiveInteger' } | { kind: 'amountTooLarge' }

export type MoneyInvalid = AmountInvalid | CurrencyUnsupported

/**
 * 金額を組み立てる。通貨コードは通貨表で確かめる（`currency.ts`）。
 *
 * 0 と負の金額は扱わない。整数でない値も受け付けない。
 */
const create = (input: { amount: number; currency: string }): Result<Money, MoneyInvalid> => {
  const currency = toCurrency(input.currency)
  if (!currency.ok) return currency

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return err({ kind: 'amountNotPositiveInteger' })
  }
  if (input.amount > MONEY_MAX_AMOUNT) return err({ kind: 'amountTooLarge' })

  return ok({ amount: input.amount, currency: currency.value })
}

/**
 * 金額への操作。
 *
 * **加減算を持たない。** 異なる通貨の金額を足せてしまう経路を作らないため
 * （`docs/domain/money.md`「通貨をまたがない」）。収支は通貨ごとに独立して導出するので、
 * 足し合わせは通貨で分けたあとの整数どうしで行う（`src/domain/settlement/balance.ts`）。
 */
export const Money = { create }

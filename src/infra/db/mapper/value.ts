import { currency, type Currency } from '../../../domain/money/currency'
import { Money, type Money as MoneyValue } from '../../../domain/money/money'
import { plainDate, type PlainDate } from '../../../domain/record/date'

/**
 * 行の値をドメインの値に読み戻すところ。
 *
 * **読めない値を既定値で埋めない。** 通貨表に無い通貨コードや、日付として読めない発生日、
 * 上限を超えた金額は、いずれも書き込まれ得ない値である。それでも現れたときに黙って
 * 別の値へ寄せると、**桁数を仮定された金額**や**別の日付**が静かに出来上がる
 * （`docs/domain/money.md`「最小単位を持たない通貨コードは扱わない」）。
 *
 * その場で落とすのは `src/domain/money/currency.ts` の `minorUnitOf` と同じ扱いで、
 * 想定していない失敗として合成ルートのログに出る（`docs/adr/0014-logging.md`）。
 * **例外の中身に値を入れない**（記録の中身をログに出さないため）。
 */

const unreadable = (what: string): never => {
  throw new RangeError(`保存された${what}を読み戻せない`)
}

export const toCurrency = (code: string): Currency => {
  const parsed = currency(code)
  return parsed.ok ? parsed.value : unreadable('通貨コード')
}

export const toPlainDate = (raw: string): PlainDate => {
  const parsed = plainDate(raw)
  return parsed.ok ? parsed.value : unreadable('発生日')
}

export const toMoney = (amount: number, code: string): MoneyValue => {
  const money = Money.create({ amount, currency: code })
  return money.ok ? money.value : unreadable('金額')
}

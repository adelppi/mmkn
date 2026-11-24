import { currency, type Currency } from '../../../domain/money/currency'
import { Money, type Money as MoneyValue } from '../../../domain/money/money'
import { plainDate, type PlainDate } from '../../../domain/record/date'

/**
 * 行の値をドメインの値に読み戻すところ。
 *
 * **読めない値を既定値で埋めず、その場で落とす。** 埋めると、桁数を仮定された金額や別の日付が静かに出来上がる。
 * **例外の中身に値を入れない**（記録の中身をログに出さないため。`docs/adr/0014-logging.md`）。
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

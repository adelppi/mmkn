import { err, ok, type Result } from '../result'

/**
 * 発生日の型（`docs/domain/record.md`「発生日」）。`YYYY-MM-DD` の形で、入力された日付をそのまま保持する。
 *
 * **`Date` を経由しない。** 一度でも時点に直すと、別の日付として読み替えられる経路ができる。
 */

declare const plainDateBrand: unique symbol

export type PlainDate = string & { readonly [plainDateBrand]: 'PlainDate' }

/** 日付として解釈できなかった。 */
export type PlainDateInvalid = { kind: 'dateInvalid' }

const FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

/** `YYYY-MM-DD` を発生日として解釈する。**未来の日付も許す**（`docs/domain/record.md`「発生日」）。 */
export const plainDate = (raw: string): Result<PlainDate, PlainDateInvalid> => {
  const matched = FORMAT.exec(raw.trim())
  if (matched === null) return err({ kind: 'dateInvalid' })

  const [, year, month, day] = matched.map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    return err({ kind: 'dateInvalid' })
  }
  if (month < 1 || month > 12) return err({ kind: 'dateInvalid' })
  if (day < 1 || day > daysInMonth(year, month)) return err({ kind: 'dateInvalid' })

  return ok(raw.trim() as PlainDate)
}

/**
 * 発生日の比較。`a` が古ければ負、新しければ正、同じなら 0 を返す。
 *
 * 桁を揃えた `YYYY-MM-DD` なので、符号単位の比較がそのまま日付の前後になる。
 */
export const comparePlainDate = (a: PlainDate, b: PlainDate): number => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

import { err, ok, type Result } from '../result'

/**
 * 発生日の型（`docs/domain/record.md`「発生日」）。
 *
 * **時刻もタイムゾーンも持たない日付。** `YYYY-MM-DD` の形で、入力された日付をそのまま保持する。
 * どの地域の日付として解釈するかという情報を持たないため、海外で記録しても後から読み替えられない。
 *
 * `Date` を使わないのは、`Date` が時点（タイムゾーンに依存する瞬間）を表すためである。
 * 一度でも `Date` を経由すると、入力された日付が別の日付として読み替えられる経路ができる。
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

/**
 * `YYYY-MM-DD` を発生日として解釈する。
 *
 * **未来の日付を許す**（`docs/domain/record.md`「発生日」）。前払いのように、これから起きる
 * 支払いを先に記録したい場面があるため。上限を見ないので、ここは現在時刻を必要としない
 * （ドメイン層は依存を持たない。`docs/adr/0004`）。
 */
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
 * 実行環境の設定に左右されない（`src/domain/id.ts` の `compareId` と同じ理由）。
 */
export const comparePlainDate = (a: PlainDate, b: PlainDate): number => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

import { err, ok, type Result } from '../result'
import { currencyTable, type CurrencyEntry } from './currency-table'

/** 通貨（`docs/domain/money.md`「扱う通貨」）。`currency()` を通らずに通貨になる経路を型で塞ぐ。 */

declare const currencyBrand: unique symbol

export type Currency = string & { readonly [currencyBrand]: 'Currency' }

/** 通貨表に無いコードが渡された。**既定値を置かず、失敗として返す**（`docs/adr/0016`）。 */
export type CurrencyUnsupported = { kind: 'currencyUnsupported' }

const byCode: ReadonlyMap<string, CurrencyEntry> = new Map(
  currencyTable.map((entry) => [entry.code, entry]),
)

/** 通貨コードを通貨として解釈する。**既定値を置かず、表に無ければ失敗する。** 廃止された通貨は通る。 */
export const currency = (raw: string): Result<Currency, CurrencyUnsupported> =>
  byCode.has(raw) ? ok(raw as Currency) : err({ kind: 'currencyUnsupported' })

/**
 * 最小単位の桁数（`docs/domain/money.md`「扱う通貨」）。
 *
 * 表に無いことは起こらないが、**既定値で埋めずに落とす。** 埋めると、桁数を仮定された金額が静かに出来上がる。
 */
export const minorUnitOf = (currency: Currency): number => {
  const entry = byCode.get(currency)
  if (entry === undefined) {
    throw new RangeError('通貨表に無い通貨コードが Currency として渡された')
  }
  return entry.minorUnit
}

/**
 * 入力候補に出す通貨を、ある表から絞り込む規則（`docs/domain/money.md`「廃止された通貨」）。
 *
 * 表を引数に取るのは、どの行にも廃止の印が立っていない状態でも規則を検証できるようにするため。
 */
export const selectableIn = (
  table: readonly CurrencyEntry[],
  recorded: readonly string[],
): readonly Currency[] => {
  const used = new Set(recorded)

  return table
    .filter((entry) => entry.withdrawn !== true || used.has(entry.code))
    .map((entry) => entry.code as Currency)
}

/** 入力候補に出す通貨。`recorded` にはそのグループの記録に現れた通貨を渡す。 */
export const selectableCurrencies = (recorded: readonly Currency[]): readonly Currency[] =>
  selectableIn(currencyTable, recorded)

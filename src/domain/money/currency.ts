import { err, ok, type Result } from '../result'
import { currencyTable, type CurrencyEntry } from './currency-table'

/**
 * 通貨（`docs/domain/money.md`「扱う通貨」）。
 *
 * **通貨表に無いコードは受け付けない。** 素の文字列と取り違えられない状態を型で作り、
 * `currency()` を通らずに金額の通貨になる経路を塞ぐ（`docs/glossary.md`「名前の付け方」）。
 */

declare const currencyBrand: unique symbol

export type Currency = string & { readonly [currencyBrand]: 'Currency' }

/** 通貨表に無いコードが渡された。**既定値を置かず、失敗として返す**（`docs/adr/0016`）。 */
export type CurrencyUnsupported = { kind: 'currencyUnsupported' }

const byCode: ReadonlyMap<string, CurrencyEntry> = new Map(
  currencyTable.map((entry) => [entry.code, entry]),
)

/**
 * 通貨コードを通貨として解釈する。
 *
 * **「知らない通貨は 2 桁とみなす」といった既定値を置かない**（`docs/domain/money.md`
 * 「最小単位を持たない通貨コードは扱わない」）。表に無ければ、その場で失敗する。
 *
 * 廃止された通貨も表に残っているため、ここは通る。**廃止で扱いが変わるのは入力候補だけ**
 * （後述 `selectableCurrencies`）で、既存の記録の解釈は変わらない。
 */
export const currency = (raw: string): Result<Currency, CurrencyUnsupported> =>
  byCode.has(raw) ? ok(raw as Currency) : err({ kind: 'currencyUnsupported' })

/**
 * 最小単位の桁数（`docs/domain/money.md`「扱う通貨」）。表示の整形はこれを使う。
 *
 * `Currency` は `currency()` を通ったものしか存在しないため、表に無いことは起こらない。
 * それでも既定値で埋めず、**表に無いことが分かる形で落とす**。握りつぶすと、
 * 桁数を仮定された金額が静かに出来上がる。
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
 * **現行の通貨と、そのグループに既にその通貨の記録がある通貨**に限る。
 * 廃止された通貨を新しい記録にも選べるようにしてあるのは、収支が残っている通貨で
 * Transfer を登録できないと、そのグループがその通貨の清算を永久に閉じられなくなるため。
 *
 * 表を引数に取るのは、**まだどの行にも廃止の印が立っていない状態でも規則そのものを検証できる**
 * ようにするためである。コミット済みの表に当てたものが `selectableCurrencies`。
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

/**
 * 入力候補に出す通貨（`docs/domain/money.md`「廃止された通貨」）。
 *
 * `recorded` にはそのグループの記録に現れた通貨を渡す。1 件も無ければ、
 * **廃止された通貨は候補に現れない。**
 */
export const selectableCurrencies = (recorded: readonly Currency[]): readonly Currency[] =>
  selectableIn(currencyTable, recorded)

import { minorUnitOf, type Currency } from '../../domain/money/currency'

/**
 * 通貨の表示整形（`docs/adr/0008-layer-internals.md` のツリー：`adapter/shared`）。
 *
 * **クライアント固有のものは置かない。** Web も Discord も同じ整形を使う。
 * **最小単位の桁数は `domain/money` が正**であり、ここでは決めない。
 *
 * 記号と通貨名は言語標準の国際化 API から得る。**表に持たないのは、それが
 * `docs/adr/0016-currency-table-committed.md` が人の手で保守すると決めた対象を増やすことになり、
 * かつ表示名は金額の解釈に一切関与しないためである。** 引けなかったコードは、そのまま返す。
 */

/** 整形した金額。**数字と記号を別に返す**のは、桁を縦にそろえて並べられるようにするため。 */
export type MoneyText = {
  /** 収支のように向きを持つ値だけが符号を持つ。持たないときは空文字。 */
  readonly sign: '' | '+' | '−'
  /** 通貨記号。引けなければ通貨コードそのもの。 */
  readonly symbol: string
  /** 最小単位の桁数で整えた数字。3 桁ごとに区切る。 */
  readonly digits: string
  /** 1 行で書くときの形。読み上げにも使う。 */
  readonly text: string
}

const LOCALE = 'ja-JP'

const symbolOf = (code: string): string => {
  try {
    // **`narrowSymbol` は使わない。** 最短形にすると TWD も USD も `$` になり、
    // **通貨をまたいで並ぶ金額**（`docs/domain/money.md`：通貨ごとに独立して導出する）を
    // 見分けられなくなる。
    const parts = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
    }).formatToParts(0)

    return parts.find((part) => part.type === 'currency')?.value ?? code
  } catch {
    return code
  }
}

/** 通貨の名前（入力候補に並べるときに使う）。引けなければ通貨コードそのもの。 */
export const currencyNameOf = (code: string): string => {
  try {
    return new Intl.DisplayNames([LOCALE], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * 最小単位を 1 とした整数を、その通貨の表示に整える。
 *
 * **桁数はドメインの通貨表から取る**（`minorUnitOf`）。国際化 API 側の桁数は使わない。
 * 使うと、ISO 4217 から削除された通貨で解釈がずれる（`docs/domain/money.md`「廃止された通貨」）。
 */
export const moneyText = (
  amount: number,
  currency: Currency,
  options: { readonly signed?: boolean } = {},
): MoneyText => {
  const minorUnit = minorUnitOf(currency)
  const absolute = Math.abs(amount)
  const unit = 10 ** minorUnit

  const whole = Math.floor(absolute / unit)
  const fraction = absolute - whole * unit

  const digits =
    minorUnit === 0
      ? new Intl.NumberFormat(LOCALE).format(whole)
      : `${new Intl.NumberFormat(LOCALE).format(whole)}.${String(fraction).padStart(minorUnit, '0')}`

  const sign: MoneyText['sign'] =
    options.signed !== true || amount === 0 ? '' : amount > 0 ? '+' : '−'

  const symbol = symbolOf(currency)

  return { sign, symbol, digits, text: `${sign}${symbol} ${digits}` }
}

/**
 * 入力された文字列を、その通貨の最小単位を 1 とした整数として読む。
 *
 * **判定はしない。** 上限も正の整数であることも `domain/money` が見る
 * （`docs/adr/0009-web-ui.md`：業務ルールを画面側にも入口にも二重に書かない）。
 * ここが担うのは「人が打つ表記」と「最小単位の整数」の間の変換だけである。
 *
 * 読めない表記は `undefined` を返す。**0 を返して埋めない**（打ち間違いが黙って通る）。
 */
export const parseAmount = (raw: string, currency: Currency): number | undefined => {
  const trimmed = raw.replace(/[,\s]/g, '')
  if (!/^\d*(\.\d*)?$/.test(trimmed) || trimmed === '' || trimmed === '.') return undefined

  const [whole = '', fraction = ''] = trimmed.split('.')
  const minorUnit = minorUnitOf(currency)

  // 最小単位より細かい桁を丸めない。**丸めると、打った額と記録された額が黙って食い違う。**
  if (fraction.length > minorUnit) return undefined

  return Number(`${whole === '' ? '0' : whole}${fraction.padEnd(minorUnit, '0')}`)
}

/** 入力欄に初期値として置くための、最小単位の整数から人が打つ表記への変換。 */
export const amountText = (amount: number, currency: Currency): string => {
  const minorUnit = minorUnitOf(currency)
  const unit = 10 ** minorUnit
  const whole = Math.floor(amount / unit)

  if (minorUnit === 0) return String(whole)

  return `${whole}.${String(amount - whole * unit).padStart(minorUnit, '0')}`
}

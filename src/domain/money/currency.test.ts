import { describe, expect, it } from 'vitest'
import type { CurrencyEntry } from './currency-table'
import {
  currency,
  minorUnitOf,
  selectableCurrencies,
  selectableIn,
  type Currency,
} from './currency'

const supported = (code: string): Currency => {
  const result = currency(code)
  if (!result.ok) throw new Error(`前提の通貨を作れなかった: ${code}`)
  return result.value
}

describe('通貨', () => {
  describe('扱う通貨', () => {
    it('表にある通貨コードを受け付ける', () => {
      expect(currency('JPY')).toEqual({ ok: true, value: 'JPY' })
      expect(currency('USD')).toEqual({ ok: true, value: 'USD' })
      expect(currency('EUR')).toEqual({ ok: true, value: 'EUR' })
    })

    it('表に無い通貨コードを受け付けない', () => {
      expect(currency('ZZZ')).toEqual({ ok: false, error: { kind: 'currencyUnsupported' } })
      expect(currency('')).toEqual({ ok: false, error: { kind: 'currencyUnsupported' } })
      expect(currency('日本円')).toEqual({ ok: false, error: { kind: 'currencyUnsupported' } })
    })

    it('表に無い通貨コードに既定の桁数を与えない', () => {
      // 「知らない通貨は 2 桁とみなす」といった既定値を置かない（`docs/domain/money.md`）。
      expect(currency('QQQ').ok).toBe(false)
    })

    it('最小単位の桁数が定められていない通貨コードは扱わない', () => {
      // 貴金属・特別引出権・テスト用のコード（`docs/domain/money.md`「最小単位を持たない通貨コードは扱わない」）。
      for (const code of ['XAU', 'XAG', 'XPT', 'XPD', 'XDR', 'XUA', 'XSU', 'XTS', 'XXX']) {
        expect(currency(code), code).toEqual({
          ok: false,
          error: { kind: 'currencyUnsupported' },
        })
      }
    })
  })

  describe('最小単位', () => {
    it('通貨ごとの桁数を返す', () => {
      expect(minorUnitOf(supported('JPY'))).toBe(0)
      expect(minorUnitOf(supported('USD'))).toBe(2)
      expect(minorUnitOf(supported('KWD'))).toBe(3)
    })

    it('0 桁の通貨と 2 桁の通貨を同じように扱う', () => {
      // 表示上の桁数が違うだけで、内部の扱いは同じ（`docs/domain/money.md`「境界・例外ケース」）。
      expect(Number.isInteger(minorUnitOf(supported('JPY')))).toBe(true)
      expect(Number.isInteger(minorUnitOf(supported('USD')))).toBe(true)
    })
  })

  describe('入力候補', () => {
    const table: readonly CurrencyEntry[] = [
      { code: 'AAA', minorUnit: 2 },
      { code: 'BBB', minorUnit: 0, withdrawn: true },
      { code: 'CCC', minorUnit: 2 },
    ]

    it('現行の通貨は、記録が 1 件も無くても候補に出る', () => {
      expect(selectableIn(table, [])).toEqual(['AAA', 'CCC'])
    })

    it('記録が 1 件もないグループの候補に、廃止された通貨は現れない', () => {
      expect(selectableIn(table, [])).not.toContain('BBB')
    })

    it('そのグループに記録がある通貨なら、廃止されていても候補に出る', () => {
      expect(selectableIn(table, ['BBB'])).toEqual(['AAA', 'BBB', 'CCC'])
    })

    it('他のグループで使われていても、そのグループに記録が無ければ候補に出ない', () => {
      // 渡すのは「そのグループの記録に現れた通貨」だけ（`docs/domain/money.md`「廃止された通貨」）。
      expect(selectableIn(table, ['CCC'])).not.toContain('BBB')
    })

    it('廃止されても表から行が消えないため、記録の通貨として解釈し続けられる', () => {
      // 候補に出るかどうかと、通貨として解釈できるかどうかは別（`docs/domain/money.md`）。
      expect(table.find((entry) => entry.code === 'BBB')?.minorUnit).toBe(0)
    })

    it('コミット済みの表では、現時点でどの行にも廃止の印が立っていない', () => {
      expect(selectableCurrencies([]).length).toBeGreaterThan(0)
      expect(selectableCurrencies([])).toContain('JPY' as Currency)
    })
  })
})

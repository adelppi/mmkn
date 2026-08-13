import { describe, expect, it } from 'vitest'
import { currencyTable } from './currency-table'

/**
 * 表そのものの妥当性（`docs/adr/0016-currency-table-committed.md`「表そのものの妥当性を単体テストで固定する」）。
 *
 * **見るのは形だけ。値が ISO 4217 と一致することはテストしない。**
 * 一致を確かめるには公表データを取りに行くことになり、それは `adr/0016` が持たないと決めたもの。
 * 値の正しさはレビューが担保する。
 */
describe('通貨表', () => {
  it('通貨コードが重複しない', () => {
    const codes = currencyTable.map((entry) => entry.code)

    expect(new Set(codes).size).toBe(codes.length)
  })

  it('桁数が 0 以上の整数である', () => {
    for (const entry of currencyTable) {
      expect(Number.isInteger(entry.minorUnit), entry.code).toBe(true)
      expect(entry.minorUnit, entry.code).toBeGreaterThanOrEqual(0)
    }
  })

  it('空の表ではない', () => {
    expect(currencyTable.length).toBeGreaterThan(0)
  })

  it('通貨コードは 3 文字の英大文字', () => {
    for (const entry of currencyTable) {
      expect(entry.code, entry.code).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('廃止の印は立っていれば true だけを取る（消えた行が false で残ることはない）', () => {
    for (const entry of currencyTable) {
      expect([undefined, true], entry.code).toContain(entry.withdrawn)
    }
  })
})

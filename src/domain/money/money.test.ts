import { describe, expect, it } from 'vitest'
import { Money, MONEY_MAX_AMOUNT } from './money'

describe('金額', () => {
  describe('金額の表し方', () => {
    it('整数 + 通貨で表す', () => {
      expect(Money.create({ amount: 100, currency: 'JPY' })).toEqual({
        ok: true,
        value: { amount: 100, currency: 'JPY' },
      })
    })

    it('最小単位を 1 とした値をそのまま持つ', () => {
      // $10.50 は 1050（`docs/domain/money.md`「金額の表し方」）。
      expect(Money.create({ amount: 1050, currency: 'USD' })).toEqual({
        ok: true,
        value: { amount: 1050, currency: 'USD' },
      })
    })

    it('小数を受け付けない', () => {
      expect(Money.create({ amount: 10.5, currency: 'USD' })).toEqual({
        ok: false,
        error: { kind: 'amountNotPositiveInteger' },
      })
    })

    it('0 と負の金額を扱わない', () => {
      expect(Money.create({ amount: 0, currency: 'JPY' })).toEqual({
        ok: false,
        error: { kind: 'amountNotPositiveInteger' },
      })
      expect(Money.create({ amount: -1, currency: 'JPY' })).toEqual({
        ok: false,
        error: { kind: 'amountNotPositiveInteger' },
      })
    })

    it('数として扱えない値を受け付けない', () => {
      expect(Money.create({ amount: Number.NaN, currency: 'JPY' }).ok).toBe(false)
      expect(Money.create({ amount: Number.POSITIVE_INFINITY, currency: 'JPY' }).ok).toBe(false)
    })
  })

  describe('通貨', () => {
    it('表に無い通貨コードを受け付けない', () => {
      expect(Money.create({ amount: 100, currency: 'ZZZ' })).toEqual({
        ok: false,
        error: { kind: 'currencyUnsupported' },
      })
    })

    it('最小単位が 0 桁の通貨も 2 桁の通貨も同じように作れる', () => {
      expect(Money.create({ amount: 1, currency: 'JPY' }).ok).toBe(true)
      expect(Money.create({ amount: 1, currency: 'USD' }).ok).toBe(true)
    })
  })

  describe('金額の上限', () => {
    it('上限は最小単位で 10 億', () => {
      expect(MONEY_MAX_AMOUNT).toBe(1_000_000_000)
    })

    it('ちょうど上限なら通る', () => {
      expect(Money.create({ amount: MONEY_MAX_AMOUNT, currency: 'JPY' }).ok).toBe(true)
    })

    it('1 超えると失敗する', () => {
      expect(Money.create({ amount: MONEY_MAX_AMOUNT + 1, currency: 'JPY' })).toEqual({
        ok: false,
        error: { kind: 'amountTooLarge' },
      })
    })

    it('上限は通貨によって変わらない', () => {
      // 桁数の違いは表示の話であり、上限は最小単位で見る（`docs/domain/money.md`「金額の上限」）。
      expect(Money.create({ amount: MONEY_MAX_AMOUNT, currency: 'USD' }).ok).toBe(true)
      expect(Money.create({ amount: MONEY_MAX_AMOUNT + 1, currency: 'USD' }).ok).toBe(false)
    })
  })
})

import { describe, expect, it } from 'vitest'
import { comparePlainDate, plainDate, type PlainDate } from './date'

const dateOf = (raw: string): PlainDate => {
  const result = plainDate(raw)
  if (!result.ok) throw new Error(`前提の日付を作れなかった: ${raw}`)
  return result.value
}

describe('発生日', () => {
  describe('解釈', () => {
    it('YYYY-MM-DD を受け付ける', () => {
      expect(plainDate('2026-08-13')).toEqual({ ok: true, value: '2026-08-13' })
    })

    it('前後の空白は落とす', () => {
      expect(plainDate(' 2026-08-13 ')).toEqual({ ok: true, value: '2026-08-13' })
    })

    it('入力された日付をそのまま保持する', () => {
      // どの地域の日付として解釈するかという情報を持たない（`docs/domain/record.md`「発生日」）。
      expect(dateOf('2026-01-01')).toBe('2026-01-01')
      expect(dateOf('2026-12-31')).toBe('2026-12-31')
    })

    it('未来の日付を許す', () => {
      // 前払いのように、これから起きる支払いを先に記録したい場面がある。
      expect(plainDate('2999-12-31').ok).toBe(true)
    })

    it('うるう年の 2 月 29 日を受け付ける', () => {
      expect(plainDate('2024-02-29').ok).toBe(true)
      expect(plainDate('2000-02-29').ok).toBe(true)
    })

    it('うるう年でない年の 2 月 29 日を受け付けない', () => {
      expect(plainDate('2026-02-29')).toEqual({ ok: false, error: { kind: 'dateInvalid' } })
      expect(plainDate('1900-02-29')).toEqual({ ok: false, error: { kind: 'dateInvalid' } })
    })

    it('存在しない月日を受け付けない', () => {
      expect(plainDate('2026-13-01').ok).toBe(false)
      expect(plainDate('2026-00-01').ok).toBe(false)
      expect(plainDate('2026-04-31').ok).toBe(false)
      expect(plainDate('2026-01-32').ok).toBe(false)
      expect(plainDate('2026-01-00').ok).toBe(false)
    })

    it('形式が違うものを受け付けない', () => {
      expect(plainDate('2026/08/13').ok).toBe(false)
      expect(plainDate('2026-8-13').ok).toBe(false)
      expect(plainDate('').ok).toBe(false)
      expect(plainDate('2026-08-13T00:00:00Z').ok).toBe(false)
    })

    it('時刻を持たない', () => {
      expect(dateOf('2026-08-13')).not.toContain('T')
    })
  })

  describe('比較', () => {
    it('古い方が小さい', () => {
      expect(comparePlainDate(dateOf('2026-08-12'), dateOf('2026-08-13'))).toBeLessThan(0)
      expect(comparePlainDate(dateOf('2026-08-13'), dateOf('2026-08-12'))).toBeGreaterThan(0)
      expect(comparePlainDate(dateOf('2026-08-13'), dateOf('2026-08-13'))).toBe(0)
    })

    it('年・月・日をまたいでも前後が正しい', () => {
      expect(comparePlainDate(dateOf('2025-12-31'), dateOf('2026-01-01'))).toBeLessThan(0)
      expect(comparePlainDate(dateOf('2026-01-31'), dateOf('2026-02-01'))).toBeLessThan(0)
    })
  })
})

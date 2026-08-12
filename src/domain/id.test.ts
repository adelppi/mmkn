import { describe, expect, it } from 'vitest'
import { compareId, idEquals, toGroupId, toMemberId, toUserId } from './id'

describe('識別子', () => {
  describe('同一性の比較', () => {
    it('同じ値なら等しい', () => {
      expect(idEquals(toMemberId('a'), toMemberId('a'))).toBe(true)
    })

    it('違う値なら等しくない', () => {
      expect(idEquals(toMemberId('a'), toMemberId('b'))).toBe(false)
    })

    it('種類の違う識別子は比べられない', () => {
      // @ts-expect-error UserId と GroupId は取り違えられない
      expect(idEquals(toUserId('a'), toGroupId('a'))).toBe(true)
    })

    it('素の文字列は識別子として渡せない', () => {
      // @ts-expect-error string は MemberId ではない
      expect(idEquals('a', toMemberId('a'))).toBe(true)
    })
  })

  describe('決定的な順序づけ', () => {
    it('小さいほうが先に来る', () => {
      expect(compareId(toMemberId('a'), toMemberId('b'))).toBeLessThan(0)
      expect(compareId(toMemberId('b'), toMemberId('a'))).toBeGreaterThan(0)
      expect(compareId(toMemberId('a'), toMemberId('a'))).toBe(0)
    })

    it('並べ替えの結果が入力の順番に依らない', () => {
      const ids = ['c9', 'a1', 'b5', 'a0'].map(toMemberId)
      const sorted = [...ids].sort(compareId)
      const fromReversed = [...ids].reverse().sort(compareId)

      expect(sorted).toEqual(['a0', 'a1', 'b5', 'c9'])
      expect(fromReversed).toEqual(sorted)
    })

    it('ロケールに左右されない（符号単位で比べる）', () => {
      // localeCompare は環境によって大文字小文字の前後が変わる。符号単位の比較は常に大文字が先。
      expect(compareId(toMemberId('B'), toMemberId('a'))).toBeLessThan(0)
    })

    it('種類の違う識別子は並べられない', () => {
      // @ts-expect-error UserId と GroupId は取り違えられない
      expect(compareId(toUserId('a'), toGroupId('b'))).toBeLessThan(0)
    })
  })
})

import { describe, expect, it } from 'vitest'
import { toMemberId } from '../id'
import { distribute } from './share'

const a = toMemberId('m-a')
const b = toMemberId('m-b')
const c = toMemberId('m-c')

const total = (shares: readonly { amount: number }[]) =>
  shares.reduce((sum, share) => sum + share.amount, 0)

describe('負担額の配分', () => {
  it('割り切れるときは均等に配る', () => {
    expect(distribute(9000, [a, b, c])).toEqual([
      { bearer: a, amount: 3000 },
      { bearer: b, amount: 3000 },
      { bearer: c, amount: 3000 },
    ])
  })

  it('割り切れないときは、配分順序の先頭から 1 単位ずつ配る', () => {
    // `docs/domain/record.md`「負担額の配分」の例。
    expect(distribute(10000, [a, b, c])).toEqual([
      { bearer: a, amount: 3334 },
      { bearer: b, amount: 3333 },
      { bearer: c, amount: 3333 },
    ])
  })

  it('余りが 2 のときは先頭 2 人に配る', () => {
    expect(distribute(11, [a, b, c])).toEqual([
      { bearer: a, amount: 4 },
      { bearer: b, amount: 4 },
      { bearer: c, amount: 3 },
    ])
  })

  it('負担額の合計は必ず金額と一致する', () => {
    for (const amount of [1, 2, 3, 10, 100, 10000, 999999999]) {
      expect(total(distribute(amount, [a, b, c])), `${amount}`).toBe(amount)
      expect(total(distribute(amount, [a, b])), `${amount}`).toBe(amount)
      expect(total(distribute(amount, [a])), `${amount}`).toBe(amount)
    }
  })

  it('負担者が 1 人なら全額を負担する', () => {
    expect(distribute(10000, [a])).toEqual([{ bearer: a, amount: 10000 }])
  })

  it('金額が負担者の人数より小さくても配りきる', () => {
    expect(distribute(2, [a, b, c])).toEqual([
      { bearer: a, amount: 1 },
      { bearer: b, amount: 1 },
      { bearer: c, amount: 0 },
    ])
  })

  describe('起きないこと', () => {
    it('入力した順番を変えても配分は変わらない', () => {
      expect(distribute(10000, [c, a, b])).toEqual(distribute(10000, [a, b, c]))
      expect(distribute(10000, [b, c, a])).toEqual(distribute(10000, [a, b, c]))
    })

    it('端数の寄せ先が、計算するたびに変わることはない', () => {
      const first = distribute(10000, [a, b, c])

      for (let i = 0; i < 10; i += 1) {
        expect(distribute(10000, [c, b, a])).toEqual(first)
      }
    })

    it('元の配列を書き換えない', () => {
      const bearers = [c, a, b]
      distribute(10000, bearers)

      expect(bearers).toEqual([c, a, b])
    })
  })
})

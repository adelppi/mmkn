import { describe, expect, it } from 'vitest'
import { cuid2IdGenerator } from './id'
import { cuid2InviteCodeGenerator } from './invite-code'

/**
 * 識別子と参加コードの性質（`docs/adr/0002-invite-code.md`・`docs/adr/0008-layer-internals.md`）。
 *
 * **`docs/domain/group.md`「前提条件を満たさなかったとき」が、「存在しない」と「Member でない」を
 * 区別する前提として推測不能性を要求している。** 総当たりで存在を探せないことが、区別しても
 * 実害が無いことの根拠になっている。ここではその性質を機械で確かめる。
 */

/** cuid2 の既定設定：英小文字と数字のみ・先頭は英字・24 文字。 */
const CUID2 = /^[a-z][a-z0-9]{23}$/

const generated = (next: () => string, count: number): string[] =>
  Array.from({ length: count }, next)

describe.each([
  ['ID', () => cuid2IdGenerator.groupId() as string],
  ['参加コード', () => cuid2InviteCodeGenerator.next()],
])('%s の性質', (_label, next) => {
  it('英小文字と数字だけの 24 文字で、先頭は英字', () => {
    expect(generated(next, 50).every((value) => CUID2.test(value))).toBe(true)
  })

  it('同じ値が出ない', () => {
    const values = generated(next, 1_000)

    expect(new Set(values).size).toBe(values.length)
  })

  it('連番になっていない', () => {
    // 連番なら生成した順がそのまま昇順になる。乱数由来であれば、そうはならない。
    // 20 個が偶然そろって昇順になる確率は 1/20! で、実質ゼロ。
    const values = generated(next, 20)
    const ascending = [...values].sort()

    expect(values).not.toEqual(ascending)
  })

  it('直前の値から次の値を組み立てられない', () => {
    // 連番やタイムスタンプ由来なら、隣り合う値はほとんどの桁が一致する。
    const values = generated(next, 20)

    const sharedPrefixes = values.slice(1).map((value, index) => {
      const previous = values[index] ?? ''
      let shared = 0
      while (shared < value.length && value[shared] === previous[shared]) shared += 1
      return shared
    })

    // 先頭が数桁そろうことはあり得るが、大半が一致することは無い。
    expect(Math.max(...sharedPrefixes)).toBeLessThan(8)
  })
})

describe('ID の種類', () => {
  it('種類が違っても同じ生成方法を使い、別の生成器を持たない', () => {
    const values = [
      cuid2IdGenerator.userId(),
      cuid2IdGenerator.groupId(),
      cuid2IdGenerator.memberId(),
      cuid2IdGenerator.paymentId(),
      cuid2IdGenerator.transferId(),
    ]

    expect(values.every((value) => CUID2.test(value))).toBe(true)
    expect(new Set(values).size).toBe(values.length)
  })
})

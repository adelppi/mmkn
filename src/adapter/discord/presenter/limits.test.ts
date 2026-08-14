import { describe, expect, it } from 'vitest'
import { clamp, intoRows, take, MAX_BUTTONS, MAX_BUTTONS_PER_ROW, MAX_ROWS } from './limits'

/**
 * 構造上の制約（`docs/adr/0006-discord-http-interactions.md`「構造上の制約」）。
 *
 * **Discord は上限違反をメッセージ単位で拒否し、原因が分かりにくい。**
 * 切り詰めがそのつど効いていることを、ここで固定する。
 */

describe('件数で切り詰める', () => {
  it('上限までは何も落とさない', () => {
    expect(take([1, 2, 3], 3)).toEqual([1, 2, 3])
  })

  it('上限を超えた分は落ちる', () => {
    expect(take([1, 2, 3, 4], 3)).toEqual([1, 2, 3])
  })

  it('空でも落ちない', () => {
    expect(take([], 3)).toEqual([])
  })
})

describe('文字数で切り詰める', () => {
  it('上限までは何も変えない', () => {
    expect(clamp('あいう', 3)).toBe('あいう')
  })

  it('溢れた分は末尾を … にして示す', () => {
    expect(clamp('あいうえ', 3)).toBe('あい…')
  })

  it('2 つの符号単位で表される文字も 1 文字として数える', () => {
    // 絵文字 1 つは符号単位では 2 つ分になる。符号単位で数えると途中で割れる。
    expect(clamp('🙂🙂', 2)).toBe('🙂🙂')
  })
})

describe('ボタンを行に割る', () => {
  const buttons = (count: number) => Array.from({ length: count }, (_, i) => i)

  it('1 行に 5 個ずつ入る', () => {
    expect(intoRows(buttons(6))).toEqual([[0, 1, 2, 3, 4], [5]])
  })

  it('5 行を超える分は落ちる', () => {
    const rows = intoRows(buttons(MAX_BUTTONS + 3))

    expect(rows).toHaveLength(MAX_ROWS)
    expect(rows.flat()).toHaveLength(MAX_BUTTONS)
    expect(rows.every((row) => row.length <= MAX_BUTTONS_PER_ROW)).toBe(true)
  })

  it('1 つも無ければ行も作らない', () => {
    expect(intoRows([])).toEqual([])
  })
})

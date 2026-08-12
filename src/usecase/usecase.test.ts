import { describe, expect, it } from 'vitest'
import { err, ok } from '../domain/result'
import type { UseCase } from './usecase'

type Input = { value: number }
type Output = { doubled: number }
type DoubleError = { kind: 'negative' }

/** 依存を引数で受け、`UseCase` を返す（`docs/adr/0008-layer-internals.md`）。 */
const double =
  (deps: { limit: number }): UseCase<Input, Output, DoubleError> =>
  async (input) =>
    input.value < 0 ? err({ kind: 'negative' }) : ok({ doubled: Math.min(input.value * 2, deps.limit) })

describe('UseCase', () => {
  it('成功を Result で返す', async () => {
    const result = await double({ limit: 100 })({ value: 2 })
    expect(result).toEqual({ ok: true, value: { doubled: 4 } })
  })

  it('失敗を Result で返す（例外を投げない）', async () => {
    const result = await double({ limit: 100 })({ value: -1 })
    expect(result).toEqual({ ok: false, error: { kind: 'negative' } })
  })

  it('依存は引数で差し替えられる', async () => {
    const result = await double({ limit: 3 })({ value: 2 })
    expect(result).toEqual({ ok: true, value: { doubled: 3 } })
  })

  it('失敗の分岐を書かずに出力へ触れない', async () => {
    const result = await double({ limit: 100 })({ value: 2 })
    // @ts-expect-error ok を見て分岐しないと value は取り出せない
    expect(result.value).toEqual({ doubled: 4 })
  })
})

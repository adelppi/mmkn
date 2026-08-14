import { afterEach, describe, expect, it, vi } from 'vitest'
import { err, ok } from '../../domain/result'
import type { UseCase } from '../../usecase/usecase'
import type { UseCaseLog } from './logger'
import { logged } from './usecase-log'

/**
 * ログの内容（`docs/adr/0014-logging.md`）。
 *
 * **絶対に出さないもの**（金額・通貨・内容・表示名・グループ名・参加コード）が出ていないことは、
 * 「出す項目を絞ってある」ことで守る。ここではその絞り込みが実際に効いているかを見る。
 */

const context = { correlationId: 'corr-1', client: 'web' as const }

const captured = (): { lines: UseCaseLog[]; restore: () => void } => {
  const lines: UseCaseLog[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((line: string) => {
    lines.push(JSON.parse(line) as UseCaseLog)
  })

  return { lines, restore: () => spy.mockRestore() }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ユースケースをログで包む', () => {
  it('成功したら、相関 ID・クライアント・ユースケース名・結果・所要時間を出す', async () => {
    const log = captured()
    const usecase: UseCase<{ secret: string }, string, never> = async () => ok('できた')

    await logged(context, 'registerPayment', usecase)({ secret: '夕食 10,000 JPY' })

    expect(log.lines).toHaveLength(1)
    expect(log.lines[0]).toMatchObject({
      correlationId: 'corr-1',
      client: 'web',
      usecase: 'registerPayment',
      outcome: 'ok',
    })
    expect(typeof log.lines[0]?.durationMs).toBe('number')
    log.restore()
  })

  it('入力も出力も出さない', async () => {
    const log = captured()
    const usecase: UseCase<{ description: string }, { amount: number }, never> = async () =>
      ok({ amount: 10_000 })

    await logged(context, 'registerPayment', usecase)({ description: '沖縄旅行の夕食' })

    expect(JSON.stringify(log.lines)).not.toContain('沖縄旅行')
    expect(JSON.stringify(log.lines)).not.toContain('10000')
    log.restore()
  })

  it('想定された失敗は、その union のタグとして出る', async () => {
    const log = captured()
    const usecase: UseCase<void, never, { kind: 'notMember' }> = async () =>
      err({ kind: 'notMember' })

    await logged(context, 'listRecords', usecase)(undefined)

    expect(log.lines[0]).toMatchObject({ outcome: 'failed', failure: 'notMember' })
    log.restore()
  })

  it('失敗がタグ以外の値を持っていても、タグ以外は出さない', async () => {
    const log = captured()
    const usecase: UseCase<void, never, { kind: 'notMember'; groupName: string }> = async () =>
      err({ kind: 'notMember', groupName: '沖縄旅行' })

    await logged(context, 'listRecords', usecase)(undefined)

    expect(log.lines[0]).toMatchObject({ outcome: 'failed', failure: 'notMember' })
    expect(JSON.stringify(log.lines)).not.toContain('沖縄旅行')
    log.restore()
  })

  it('例外は想定された失敗と区別して出し、握りつぶさない', async () => {
    const log = captured()
    const usecase: UseCase<void, never, never> = async () => {
      throw new RangeError('保存された金額を読み戻せない')
    }

    await expect(logged(context, 'listRecords', usecase)(undefined)).rejects.toThrow(RangeError)

    expect(log.lines[0]).toMatchObject({ outcome: 'threw', failure: 'RangeError' })
    log.restore()
  })

  it('例外のメッセージは出さない', async () => {
    const log = captured()
    const usecase: UseCase<void, never, never> = async () => {
      throw new Error('duplicate key value violates unique constraint: 沖縄旅行')
    }

    await expect(logged(context, 'listRecords', usecase)(undefined)).rejects.toThrow()

    expect(JSON.stringify(log.lines)).not.toContain('沖縄旅行')
    log.restore()
  })

  it('相関 ID で、同じリクエストの実行をまとめて絞れる', async () => {
    const log = captured()
    const usecase: UseCase<void, string, never> = async () => ok('できた')

    await logged(context, 'viewSettlement', usecase)(undefined)
    await logged(context, 'listRecords', usecase)(undefined)

    expect(log.lines.every((line) => line.correlationId === 'corr-1')).toBe(true)
    log.restore()
  })
})

import { compareId, type PaymentId, type TransferId } from '../id'
import { comparePlainDate, type PlainDate } from './date'
import type { Payment } from './payment'
import type { Transfer } from './transfer'

/** 記録の並び（`docs/domain/record.md`「記録の並び」）。 */

/** 支払いと送金の総称。`Record` が TypeScript 組み込みの型と衝突するため `AnyRecord` とする。 */
export type AnyRecord = Payment | Transfer

/** 並びに要るものだけ。Payment と Transfer に共通する。 */
type Sortable = {
  readonly id: PaymentId | TransferId
  readonly occurredOn: PlainDate
  readonly recordedAt: Date
}

/**
 * 記録の並び順（`docs/domain/record.md`「記録の並び」）。
 *
 * 最後の決め手に使う順序は、`share.ts` の配分順序とは**別のもの**。
 */
export const compareRecords = (a: Sortable, b: Sortable): number => {
  const byOccurredOn = comparePlainDate(b.occurredOn, a.occurredOn)
  if (byOccurredOn !== 0) return byOccurredOn

  const byRecordedAt = b.recordedAt.getTime() - a.recordedAt.getTime()
  if (byRecordedAt !== 0) return byRecordedAt

  return compareId(a.id, b.id)
}

/** 記録を一覧の並びに整える。元の配列は書き換えない。 */
export const sortRecords = <T extends Sortable>(records: readonly T[]): readonly T[] =>
  [...records].sort(compareRecords)

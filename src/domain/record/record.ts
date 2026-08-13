import { compareId, type PaymentId, type TransferId } from '../id'
import { comparePlainDate, type PlainDate } from './date'
import type { Payment } from './payment'
import type { Transfer } from './transfer'

/**
 * 記録の並び（`docs/domain/record.md`「記録の並び」）。
 *
 * **Payment と Transfer をまとめて 1 つの列として扱う。種類によって分けない。**
 * この並びは表示のためだけのもので、収支・清算案の結果には影響しない。
 */

/**
 * 支払いと送金の総称（`docs/glossary.md` の `record`）。
 *
 * 型の名前だけ `AnyRecord` としてあるのは、`Record` が TypeScript 組み込みの型と衝突するため
 * （`src/domain/id.ts` の `AnyId` と同じ形）。
 */
export type AnyRecord = Payment | Transfer

/** 並びに要るものだけ。Payment と Transfer に共通する。 */
type Sortable = {
  readonly id: PaymentId | TransferId
  readonly occurredOn: PlainDate
  readonly recordedAt: Date
}

/**
 * 記録の並び順。**発生日の新しい順**、同じ発生日は**登録日時の新しい順**（後から登録したものが先）。
 *
 * 登録日時まで同じ場合は、**記録の変わらない同一性による決定的な順序**で決める。
 * ドメインが要求するのは並びが揺れないことだけで、どちらが先かは規定していない。
 *
 * ここで使う順序は、`share.ts` の配分順序とは**別のもの**。
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

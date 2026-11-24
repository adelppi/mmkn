import { compareId, type MemberId } from '../id'

/** 負担額の配分（`docs/domain/record.md`「負担額の配分」）。 */

/** 負担者ひとり分の負担額。 */
export type Share = {
  readonly bearer: MemberId
  /** その通貨の最小単位を 1 とした値（`docs/domain/money.md`）。 */
  readonly amount: number
}

/** 配分順序（`docs/domain/record.md`「負担額の配分」）。 */
export const memberOrder = (a: MemberId, b: MemberId): number => compareId(a, b)

/**
 * 金額を負担者へ均等に配分する。余りは、配分順序の先頭から 1 単位ずつ配る。
 *
 * 金額は既に最小単位を 1 とした整数なので、通貨ごとに配り方が変わることはない。
 */
export const distribute = (amount: number, bearers: readonly MemberId[]): readonly Share[] => {
  const ordered = [...bearers].sort(memberOrder)

  const base = Math.floor(amount / ordered.length)
  const remainder = amount - base * ordered.length

  return ordered.map((bearer, index) => ({ bearer, amount: base + (index < remainder ? 1 : 0) }))
}

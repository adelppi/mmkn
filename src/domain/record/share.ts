import { compareId, type MemberId } from '../id'

/**
 * 負担額の配分（`docs/domain/record.md`「負担額の配分」）。
 *
 * 金額は負担者に均等に配分し、**負担額の合計は必ず金額と一致する。**
 */

/** 負担者ひとり分の負担額。 */
export type Share = {
  readonly bearer: MemberId
  /** その通貨の最小単位を 1 とした値（`docs/domain/money.md`）。 */
  readonly amount: number
}

/**
 * 配分順序（`docs/glossary.md` の `memberOrder`）。
 *
 * **Member が持つ変わらない同一性による決定的な順序**であり、画面上の表示順とは関係しない。
 * 負担者を入力した順番や画面上の並び順を変えても、配分は変わらない。
 */
export const memberOrder = (a: MemberId, b: MemberId): number => compareId(a, b)

/**
 * 金額を負担者へ均等に配分する。
 *
 * 割り切れない場合、余りは通貨の最小単位ごとに、**配分順序の先頭から 1 単位ずつ**配る。
 * 金額は既に最小単位を 1 とした整数なので（`docs/domain/money.md`「金額の表し方」）、
 * ここでいう 1 単位は 1 にあたり、通貨ごとに配り方が変わることはない。
 *
 * **支払者であることを理由に端数を優先して割り当てることはしない。** 見るのは配分順序だけ。
 */
export const distribute = (amount: number, bearers: readonly MemberId[]): readonly Share[] => {
  const ordered = [...bearers].sort(memberOrder)

  const base = Math.floor(amount / ordered.length)
  const remainder = amount - base * ordered.length

  return ordered.map((bearer, index) => ({ bearer, amount: base + (index < remainder ? 1 : 0) }))
}

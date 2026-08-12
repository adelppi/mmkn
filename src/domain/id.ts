/**
 * 識別子の型。`GroupId` と `MemberId` を取り違えられない状態を型で作る（`docs/glossary.md`「名前の付け方」）。
 *
 * 値の作り方（乱数由来・推測できないこと）はドメインの外の責務で、
 * ここは「取り違えないこと」「比べられること」「決定的に並べられること」だけを持つ。
 */

declare const idBrand: unique symbol

type Id<Tag extends string> = string & { readonly [idBrand]: Tag }

export type UserId = Id<'UserId'>
export type GroupId = Id<'GroupId'>
export type MemberId = Id<'MemberId'>
export type PaymentId = Id<'PaymentId'>
export type TransferId = Id<'TransferId'>

/** どの識別子でもよいことを表す。比較・順序づけの制約にだけ使う。 */
export type AnyId = UserId | GroupId | MemberId | PaymentId | TransferId

export const toUserId = (value: string): UserId => value as UserId
export const toGroupId = (value: string): GroupId => value as GroupId
export const toMemberId = (value: string): MemberId => value as MemberId
export const toPaymentId = (value: string): PaymentId => value as PaymentId
export const toTransferId = (value: string): TransferId => value as TransferId

/**
 * 同一性の比較。種類の違う識別子どうしは型検査で弾かれる。
 */
export const idEquals = <T extends AnyId>(a: T, b: NoInfer<T>): boolean => a === b

/**
 * 決定的な順序づけ。`a < b` なら負、`a > b` なら正、等しければ 0 を返す。
 *
 * 実行環境の設定に左右されないよう、文字列の符号単位で比べる（ロケールを見る比較を使わない）。
 * `docs/domain/record.md`「負担額の配分」が要求する
 * 「同じ集合に対しては何度計算しても常に同じ結果になること」がこれで成り立つ。
 */
export const compareId = <T extends AnyId>(a: T, b: NoInfer<T>): number => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

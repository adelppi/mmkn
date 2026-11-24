/** フォームの形（`docs/adr/0009-web-ui.md`「フォーム」）。 */

/**
 * Controller のシグネチャ。直前の状態と入力を受けて、次の状態を返す。
 *
 * ビューモデルは素の値だけで構成するため、操作の口であるこれは別に受け取る。
 */
export type FormAction<V> = (previous: V, data: FormData) => Promise<V>

/** Presentational の props。**ビューモデルがそのまま props の形になる。** */
export type FormProps<V> = V & { readonly action: FormAction<V> }

/** 入力欄に渡す制約（`docs/adr/0009`「クライアント側の入力検査」）。**数値はドメイン層の定数から取る。** */
export type TextFieldLimits = {
  readonly maxLength: number
  readonly required: boolean
}

export type AmountFieldLimits = {
  /** その通貨の表記での上限。最小単位の整数ではない。 */
  readonly max: string
  /** その通貨の最小単位。 */
  readonly step: string
  readonly required: true
}

/** 素の文字列として `FormData` から 1 つ取り出す。無ければ空文字。 */
export const field = (data: FormData, name: string): string => {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

/** 無くてもよい入力。**空文字も、無いものとして扱う。** */
export const optionalField = (data: FormData, name: string): string | undefined =>
  field(data, name) || undefined

/** 同じ名前で複数送られてくる入力（負担者の選択など）を取り出す。 */
export const fields = (data: FormData, name: string): readonly string[] =>
  data.getAll(name).flatMap((value) => (typeof value === 'string' && value !== '' ? [value] : []))

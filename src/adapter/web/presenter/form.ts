/**
 * フォームの形（`docs/adr/0009-web-ui.md`「フォーム」）。
 *
 * **Server Action の戻り値がフォームの状態である。** フォーム状態管理のライブラリを入れず、
 * 状態の正を「サーバーが返したビューモデル」1 つに保つ。**初期状態も Presenter が持つ。**
 */

/**
 * Controller のシグネチャ。直前の状態と入力を受けて、次の状態を返す。
 *
 * Presentational は**これを props で受け取るだけ**で、呼び先も、どの層にあるかも知らない。
 * ビューモデルは素の値だけで構成する（`docs/adr/0009`）ため、操作の口であるこれは
 * ビューモデルに含めず、別に受け取る形にしてある。
 */
export type FormAction<V> = (previous: V, data: FormData) => Promise<V>

/** Presentational の props。**ビューモデルがそのまま props の形になる。** */
export type FormProps<V> = V & { readonly action: FormAction<V> }

/**
 * 入力欄に渡す制約（`docs/adr/0009`「クライアント側の入力検査」）。
 *
 * **クライアントで行う検査はブラウザ標準の入力属性までにとどめる。** 業務ルールは書かない。
 * **数値はドメイン層が公開する定数から取る。** 画面側にも、この型にも打たない。
 */
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

/** 同じ名前で複数送られてくる入力（負担者の選択など）を取り出す。 */
export const fields = (data: FormData, name: string): readonly string[] =>
  data.getAll(name).flatMap((value) => (typeof value === 'string' && value !== '' ? [value] : []))

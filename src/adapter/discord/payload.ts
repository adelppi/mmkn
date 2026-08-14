import type {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteraction,
  APIApplicationCommandInteractionDataOption,
  APIChatInputApplicationCommandInteractionData,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
  APISelectMenuOption,
} from 'discord-api-types/v10'
import { COMPONENT, OPTION_TYPE } from './protocol'

/**
 * Interaction のペイロードから値を読む。
 *
 * **ペイロードの型は `discord-api-types` を使い、自前で定義しない**（`docs/adr/0008-layer-internals.md`）。
 * ここが担うのは、その型から mmkn が使う形（文字列と文字列の配列）を取り出すことだけで、
 * 判定も変換も持たない。**読めなかったものを既定値で埋めない。**
 */

// ── スラッシュコマンド ────────────────────────────────────────────────────────

export type Subcommand = {
  readonly name: string
  readonly options: readonly APIApplicationCommandInteractionDataOption[]
}

/**
 * サブコマンドを読む。
 *
 * 操作はすべて 1 つのトップレベルコマンドの下に生えるため（`definitions.ts`）、
 * 分岐に使うのはここで取り出す名前になる。
 */
export const subcommandOf = (
  interaction: APIApplicationCommandInteraction | APIApplicationCommandAutocompleteInteraction,
): Subcommand | undefined => {
  const data = interaction.data as APIChatInputApplicationCommandInteractionData
  const first = data.options?.[0]
  if (first === undefined || first.type !== OPTION_TYPE.subcommand) return undefined

  return { name: first.name, options: first.options ?? [] }
}

/** 文字列の引数を読む。**渡されなければ `undefined`。** */
export const stringOption = (
  options: readonly APIApplicationCommandInteractionDataOption[],
  name: string,
): string | undefined => {
  const option = options.find((it) => it.name === name)
  if (option === undefined || option.type !== OPTION_TYPE.string) return undefined

  return option.value
}

/** オートコンプリートで、いま入力中の引数の値。 */
export const focusedValue = (
  interaction: APIApplicationCommandAutocompleteInteraction,
): { readonly name: string; readonly typed: string } | undefined => {
  const subcommand = subcommandOf(interaction)
  if (subcommand === undefined) return undefined

  const focused = subcommand.options.find(
    (option) => option.type === OPTION_TYPE.string && option.focused === true,
  )
  if (focused === undefined || focused.type !== OPTION_TYPE.string) return undefined

  return { name: focused.name, typed: focused.value }
}

// ── メッセージ部品 ────────────────────────────────────────────────────────────

/** セレクトで選ばれた値。ボタンなど、値を持たない部品では空になる。 */
export const selectedValues = (
  interaction: APIMessageComponentInteraction,
): readonly string[] => {
  const data = interaction.data
  return 'values' in data ? data.values : []
}

/**
 * 押されたメッセージに載っていたセレクトの候補を取り出す。
 *
 * **これが「モーダルを開く応答を永続化に問い合わせずに組み立てる」ための経路である**
 * （`docs/adr/0006-discord-http-interactions.md`「負担者の選択とモーダルを直列にしない」）。
 * 候補は 1 つ前の Interaction が引いてメッセージに載せたもので、押下時のペイロードに同梱される。
 *
 * **取り出すのは選択肢であって、書き込みの入力にする値ではない。** 実際に書き込まれるのは
 * モーダルから返ってきた値であり、その妥当性はドメインが判定する（`docs/adr/0006`
 * 「メッセージに埋めた値を信じない」が禁じているのは、埋まっていた値をそのまま書き込むこと）。
 */
export const carriedOptions = (
  interaction: APIMessageComponentInteraction,
  customId: string,
): readonly APISelectMenuOption[] => {
  for (const row of interaction.message.components ?? []) {
    if (row.type !== COMPONENT.actionRow) continue

    for (const component of row.components) {
      if (component.type !== COMPONENT.stringSelect) continue
      if (component.custom_id !== customId) continue

      return component.options
    }
  }

  return []
}

// ── モーダル ─────────────────────────────────────────────────────────────────

/**
 * モーダルから返ってきた値。
 *
 * **入力部品は `LABEL` に入れて送っているため、返りも `LABEL` に包まれて届く**
 * （`docs/adr/0006`「構造上の制約」）。`ACTION_ROW` で届く形も読めるようにしてある。
 */
export type ModalValues = {
  /** 文字入力の値。**打たれなかった欄は空文字。** */
  readonly text: (name: string) => string
  /** セレクトで選ばれた値。**選ばれなかったら空。** */
  readonly list: (name: string) => readonly string[]
}

export const modalValues = (interaction: APIModalSubmitInteraction): ModalValues => {
  const texts = new Map<string, string>()
  const lists = new Map<string, readonly string[]>()

  /**
   * 1 つの入力部品から値を取り出す。
   *
   * **部品の種類ごとに分岐しない。** 文字入力は `value`、セレクトのたぐいは `values` を持つ、
   * という形だけを見る。**新しい種類の部品を足しても、ここは変わらない。**
   */
  const read = (component: { readonly custom_id: string }): void => {
    const holder: Record<string, unknown> = component
    const name = component.custom_id

    const value = holder['value']
    if (typeof value === 'string') texts.set(name, value)

    const values = holder['values']
    if (Array.isArray(values)) lists.set(name, values.filter((it) => typeof it === 'string'))
  }

  for (const component of interaction.data.components) {
    if (component.type === COMPONENT.label) read(component.component)
    else if (component.type === COMPONENT.actionRow) for (const it of component.components) read(it)
  }

  return {
    text: (name) => texts.get(name) ?? '',
    list: (name) => lists.get(name) ?? [],
  }
}

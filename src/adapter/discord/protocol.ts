import type {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  TextInputStyle,
} from 'discord-api-types/v10'

/**
 * Discord の Interaction が使う数値（`docs/adr/0006-discord-http-interactions.md`）。
 *
 * **ペイロードの型は `discord-api-types` を使い、自前で定義しない**（`docs/adr/0008-layer-internals.md`）。
 * ただし採用の理由は「**型のみでランタイム依存を持たない**」ことであるため、
 * enum を値として import することはしない。**値は `import type` した enum の型に照らして固定する。**
 *
 * ```ts
 * export const INTERACTION = { ping: 1 } as const satisfies Record<string, InteractionType>
 * //                                  ^ 誤った数値はここで型検査に落ちる
 * ```
 *
 * これで、数値の正は引き続き `discord-api-types` の側にあり、書き写しの誤りは検査で落ちる。
 * **プロトコルの定数をここ以外に打たない。**
 */

/** 扱う Interaction の種別。**この 5 種だけを扱う**（`docs/adr/0006`「扱う Interaction 種別」）。 */
export const INTERACTION = {
  ping: 1,
  applicationCommand: 2,
  messageComponent: 3,
  autocomplete: 4,
  modalSubmit: 5,
} as const satisfies Record<string, InteractionType>

/**
 * 応答の種別。
 *
 * `deferredMessage` と `deferredUpdate` の 2 つが「メッセージで応答するもの」の入口で、
 * **本文はどちらも follow-up で送る**（`docs/adr/0006`）。`pong` / `modal` / `autocompleteResult`
 * は defer できないため、その場で返しきる。
 */
export const RESPONSE = {
  pong: 1,
  /** 新しいメッセージを送る形の deferred（「考え中」が出る）。 */
  deferredMessage: 5,
  /** 元のメッセージを差し替える形の deferred（「考え中」は出ない）。 */
  deferredUpdate: 6,
  autocompleteResult: 8,
  modal: 9,
} as const satisfies Record<string, InteractionResponseType>

export const COMPONENT = {
  actionRow: 1,
  button: 2,
  stringSelect: 3,
  textInput: 4,
  /** **モーダルの中の入力部品はこれに入れる**（メッセージ側の `actionRow` とは包み方が違う）。 */
  label: 18,
} as const satisfies Record<string, ComponentType>

/** 実行者だけに見える返信（`docs/adr/0006`「返信の可視性」）。 */
export const EPHEMERAL_FLAG = 64 satisfies MessageFlags

export const COMMAND_TYPE = { chatInput: 1 } as const satisfies Record<string, ApplicationCommandType>

export const OPTION_TYPE = {
  subcommand: 1,
  string: 3,
} as const satisfies Record<string, ApplicationCommandOptionType>

export const TEXT_INPUT_STYLE = {
  short: 1,
  paragraph: 2,
} as const satisfies Record<string, TextInputStyle>

export const BUTTON_STYLE = {
  primary: 1,
  secondary: 2,
} as const satisfies Record<string, ButtonStyle>

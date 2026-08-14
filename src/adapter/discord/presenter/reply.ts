import type {
  APIActionRowComponent,
  APIButtonComponentWithCustomId,
  APIComponentInMessageActionRow,
  APIEmbed,
  APIEmbedField,
  APISelectMenuOption,
  APIStringSelectComponent,
} from 'discord-api-types/v10'
import { BUTTON_STYLE, COMPONENT } from '../protocol'
import {
  clamp,
  intoRows,
  take,
  MAX_CHOICES,
  MAX_DESCRIPTION_LENGTH,
  MAX_EMBED_FIELDS,
  MAX_FIELD_VALUE_LENGTH,
} from './limits'
import { messageOf, type FailureTag } from './message'

/**
 * Discord への返信の組み立て（`docs/adr/0006-discord-http-interactions.md`「表示」）。
 *
 * **表示は Embed で行い、プレーンテキストにしない。** 組み立てはこの Presenter に閉じる。
 * 他のクライアントは同じデータを別形式で描画する（`docs/adr/0004-layers-and-dependencies.md`）。
 *
 * **上限による切り詰めはここを通す**（`./limits.ts`）。Discord は上限違反をメッセージ単位で
 * 拒否し、原因が分かりにくいため、組み立てる側でまとめて収める。
 */

/**
 * follow-up で送る本文。
 *
 * **`components` は省略できない。** Discord のメッセージ差し替えでは省いたフィールドが
 * 変更されないため、省略を許すと**操作が不要になったのに古いボタンが残る**
 * （`docs/adr/0006`「メッセージコンポーネント」）。空なら空と明示させる。
 */
export type Reply = {
  readonly embeds: readonly APIEmbed[]
  readonly components: readonly APIActionRowComponent<APIComponentInMessageActionRow>[]
}

const COLOR = {
  /** 記録できた・対応づけられた。 */
  done: 0x2f9e44,
  /** 前提を満たさなかった。 */
  denied: 0xe03131,
  /** 見るだけのもの・案内。 */
  notice: 0x1971c2,
} as const

export const field = (name: string, value: string): APIEmbedField => ({
  name,
  value: clamp(value, MAX_FIELD_VALUE_LENGTH),
  inline: false,
})

export const embed = (input: {
  readonly title: string
  readonly description?: string
  readonly fields?: readonly APIEmbedField[]
  readonly tone: keyof typeof COLOR
}): APIEmbed => ({
  title: input.title,
  color: COLOR[input.tone],
  ...(input.description === undefined
    ? {}
    : { description: clamp(input.description, MAX_DESCRIPTION_LENGTH) }),
  ...(input.fields === undefined ? {} : { fields: [...take(input.fields, MAX_EMBED_FIELDS)] }),
})

/** 見るだけの返信・案内。**部品は付かない。** */
export const notice = (title: string, description: string): Reply => ({
  embeds: [embed({ title, description, tone: 'notice' })],
  components: [],
})

/**
 * 前提条件を満たさなかったことを伝える。
 *
 * **握りつぶさない**（`docs/domain/group.md`「前提条件を満たさなかったとき」）。
 * **部品を空で返す**ため、失敗を返した時点で古いボタンは残らない。
 */
export const denied = (error: { readonly kind: FailureTag }): Reply => ({
  embeds: [embed({ title: '実行できませんでした', description: messageOf(error), tone: 'denied' })],
  components: [],
})

/** 記録できた・対応づけられたことを伝える。 */
export const done = (input: {
  readonly title: string
  readonly description?: string
  readonly fields?: readonly APIEmbedField[]
  readonly components?: readonly APIActionRowComponent<APIComponentInMessageActionRow>[]
}): Reply => ({
  embeds: [embed({ title: input.title, description: input.description, fields: input.fields, tone: 'done' })],
  components: input.components === undefined ? [] : input.components,
})

// ── 部品 ─────────────────────────────────────────────────────────────────────

export const button = (input: {
  readonly customId: string
  readonly label: string
  readonly primary?: boolean
}): APIButtonComponentWithCustomId => ({
  type: COMPONENT.button,
  style: input.primary === true ? BUTTON_STYLE.primary : BUTTON_STYLE.secondary,
  custom_id: input.customId,
  label: input.label,
})

/** ボタンを 1 行 5 個ずつに割る。**5 行を超える分は落ちる**（`./limits.ts`）。 */
export const buttonRows = (
  buttons: readonly APIButtonComponentWithCustomId[],
): readonly APIActionRowComponent<APIComponentInMessageActionRow>[] =>
  intoRows(buttons).map((row) => ({ type: COMPONENT.actionRow, components: [...row] }))

export const choice = (value: string, label: string): APISelectMenuOption => ({
  value,
  label: clamp(label, 100),
})

/**
 * セレクト。**候補は 25 件まで**（`./limits.ts`）。
 *
 * `disabled` を立てたものは、**候補を次の Interaction まで運ぶためだけに置く**
 * （`docs/adr/0006`「負担者の選択とモーダルを直列にしない」の実現方法。`./modal.ts`）。
 * 押せないため、セレクトとモーダルを直列に繋ぐことにはならない。
 */
export const select = (input: {
  readonly customId: string
  readonly placeholder: string
  readonly options: readonly APISelectMenuOption[]
  readonly disabled?: boolean
  readonly minValues?: number
  readonly maxValues?: number
}): APIStringSelectComponent => {
  const options = [...take(input.options, MAX_CHOICES)]

  return {
    type: COMPONENT.stringSelect,
    custom_id: input.customId,
    placeholder: clamp(input.placeholder, 150),
    options,
    ...(input.disabled === true ? { disabled: true } : {}),
    ...(input.minValues === undefined ? {} : { min_values: input.minValues }),
    ...(input.maxValues === undefined
      ? {}
      : { max_values: Math.min(input.maxValues, options.length) }),
  }
}

export const selectRow = (
  menu: APIStringSelectComponent,
): APIActionRowComponent<APIComponentInMessageActionRow> => ({
  type: COMPONENT.actionRow,
  components: [menu],
})

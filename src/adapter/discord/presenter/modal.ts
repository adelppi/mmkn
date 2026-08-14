import type {
  APILabelComponent,
  APIModalInteractionResponseCallbackComponent,
  APIModalInteractionResponseCallbackData,
  APISelectMenuOption,
  APIStringSelectComponent,
  APITextInputComponent,
} from 'discord-api-types/v10'
import { GROUP_NAME_MAX_LENGTH } from '../../../domain/group/text'
import { selectableCurrencies } from '../../../domain/money/currency'
import { DESCRIPTION_MAX_LENGTH } from '../../../domain/record/payment'
import { customId, FIELD } from '../definitions'
import { COMPONENT, TEXT_INPUT_STYLE } from '../protocol'
import { take, MAX_CHOICES, MAX_MODAL_COMPONENTS } from './limits'
import { select } from './reply'

/**
 * モーダルの組み立て（`docs/adr/0006-discord-http-interactions.md`「モーダル」）。
 *
 * **ここは永続化に一切問い合わせない。** モーダルを開く応答は `APPLICATION_COMMAND` か
 * `MESSAGE_COMPONENT` への**初回応答**としてしか送れず、defer による救済が効かない。
 * 3 秒の枠に DB への往復を入れると、そこだけ無反応で壊れる。
 *
 * そのため、この関数が受け取るのは**すべて Interaction のペイロードから復元できる値**である。
 * 負担者・送り手・受け手の候補は、1 つ前の Interaction（deferred できるコマンド）が引いて
 * 返信の中の押せないセレクトに載せたものを、押下時のペイロードから取り出して渡す
 * （復元は `controller/component/open-input.ts`）。
 *
 * **1 つの操作の入力は 1 枚で完結する。** モーダルとセレクトを直列に繋がない。
 *
 * **入力長の上限は `domain/` から取る**（`CLAUDE.md`・`docs/adr/0006`「構造上の制約」）。
 * ここで独自の数値を打たない。
 */

/** 通貨コードの長さ。**表そのものから取る**（`docs/domain/money.md` の通貨表が正）。 */
const currencyCodeLength = (): number =>
  Math.max(...selectableCurrencies([]).map((code) => code.length))

const label = (
  text: string,
  component: APILabelComponent['component'],
  description?: string,
): APILabelComponent => ({
  type: COMPONENT.label,
  label: text,
  ...(description === undefined ? {} : { description }),
  component,
})

const textInput = (input: {
  readonly name: string
  readonly value?: string
  readonly placeholder?: string
  readonly maxLength?: number
  readonly paragraph?: boolean
  readonly required?: boolean
}): APITextInputComponent => ({
  type: COMPONENT.textInput,
  custom_id: input.name,
  style: input.paragraph === true ? TEXT_INPUT_STYLE.paragraph : TEXT_INPUT_STYLE.short,
  ...(input.value === undefined ? {} : { value: input.value }),
  ...(input.placeholder === undefined ? {} : { placeholder: input.placeholder }),
  ...(input.maxLength === undefined ? {} : { max_length: input.maxLength }),
  ...(input.required === undefined ? {} : { required: input.required }),
})

/**
 * Member を選ぶセレクト。**モーダルの中では `LABEL` に入れる**（メッセージの中では `ACTION_ROW`）。
 *
 * `default: true` で既定値を提示する（`docs/adr/0006`「ユーザー選択 UI」）。
 * **候補は 25 件まで**であり、`docs/adr/0006` が受け入れた制約として、
 * Member が 25 人を超えるグループでは選びきれない。**回避策を作らない。**
 */
const memberSelect = (input: {
  readonly name: string
  readonly placeholder: string
  readonly options: readonly APISelectMenuOption[]
  readonly selected?: string
  readonly multiple?: boolean
}): APIStringSelectComponent =>
  select({
    customId: input.name,
    placeholder: input.placeholder,
    options: input.options.map((option) =>
      option.value === input.selected ? { ...option, default: true } : option,
    ),
    minValues: 1,
    maxValues: input.multiple === true ? MAX_CHOICES : 1,
  })

const modal = (input: {
  readonly customId: string
  readonly title: string
  readonly components: readonly APIModalInteractionResponseCallbackComponent[]
}): APIModalInteractionResponseCallbackData => ({
  custom_id: input.customId,
  title: input.title,
  components: [...take(input.components, MAX_MODAL_COMPONENTS)],
})

/**
 * グループを作る（`docs/domain/group.md`「グループを作成する」）。
 *
 * **候補を必要としないため、スラッシュコマンドへの初回応答としてそのまま開ける。**
 */
export const createGroupModal = (): APIModalInteractionResponseCallbackData =>
  modal({
    customId: customId('create-group'),
    title: 'グループを作る',
    components: [
      label(
        'グループ名',
        textInput({ name: FIELD.groupName, maxLength: GROUP_NAME_MAX_LENGTH }),
      ),
      label(
        '既定通貨',
        textInput({
          name: FIELD.defaultCurrency,
          value: 'JPY',
          maxLength: currencyCodeLength(),
        }),
        '金額を入力するときの初期値です。他の通貨も記録できます。',
      ),
    ],
  })

/**
 * モーダルを組み立てるのに要る値。**すべて Interaction のペイロードから復元できるものに限る。**
 *
 * **対象の Group は含まない。** 場からその都度解決するため（`docs/adr/0006`「対象 Group の解決」）、
 * モーダルに載せて運ぶ必要がない。
 */
export type InputContext = {
  readonly currency: string
  /** 発生日の初期値。**初期値であって、日付そのものの意味を決めるものではない**（`docs/domain/record.md`）。 */
  readonly occurredOn: string
  /** 操作する人自身の Member。既定値の提示にだけ使う。 */
  readonly actorMemberId: string
  readonly members: readonly APISelectMenuOption[]
}

const amountField = (currency: string) =>
  label('金額', textInput({ name: FIELD.amount, placeholder: `${currency} で入力` }))

const occurredOnField = (occurredOn: string) =>
  label(
    '発生日',
    textInput({ name: FIELD.occurredOn, value: occurredOn, placeholder: 'YYYY-MM-DD' }),
  )

/**
 * 支払いを記録する（`docs/domain/record.md`「Payment（支払い）」）。
 *
 * **金額・内容・負担者を 1 枚で受ける**（`docs/adr/0006`「負担者の選択とモーダルを直列にしない」）。
 * 通貨はコマンドの引数で受け取っているため、ここには現れない（枠は 5 つしかない）。
 */
export const paymentModal = (input: InputContext): APIModalInteractionResponseCallbackData =>
  modal({
    customId: customId('payment', input.currency),
    title: '支払いを記録する',
    components: [
      label(
        '支払った人',
        memberSelect({
          name: FIELD.payer,
          placeholder: '支払った人を選ぶ',
          options: input.members,
          selected: input.actorMemberId,
        }),
      ),
      label(
        '負担する人',
        memberSelect({
          name: FIELD.bearers,
          placeholder: '負担する人を選ぶ（複数可）',
          options: input.members,
          multiple: true,
        }),
      ),
      amountField(input.currency),
      occurredOnField(input.occurredOn),
      label(
        '内容',
        textInput({
          name: FIELD.description,
          maxLength: DESCRIPTION_MAX_LENGTH,
          paragraph: true,
          // **内容は任意。空でもよい**（`docs/domain/record.md`「属性」）。
          required: false,
        }),
      ),
    ],
  })

/**
 * 送金を記録する（`docs/domain/record.md`「Transfer（送金）」）。
 *
 * **Transfer は内容を持たない。** 送金そのものだけを記録する。
 */
export const transferModal = (input: InputContext): APIModalInteractionResponseCallbackData =>
  modal({
    customId: customId('transfer', input.currency),
    title: '送金を記録する',
    components: [
      label(
        '送った人',
        memberSelect({
          name: FIELD.sender,
          placeholder: '送った人を選ぶ',
          options: input.members,
          selected: input.actorMemberId,
        }),
      ),
      label(
        '受け取った人',
        memberSelect({
          name: FIELD.recipient,
          placeholder: '受け取った人を選ぶ',
          options: input.members,
        }),
      ),
      amountField(input.currency),
      occurredOnField(input.occurredOn),
    ],
  })

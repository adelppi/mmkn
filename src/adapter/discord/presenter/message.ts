import { GROUP_NAME_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from '../../../domain/group/text'
import { currency } from '../../../domain/money/currency'
import { MONEY_MAX_AMOUNT } from '../../../domain/money/money'
import { DESCRIPTION_MAX_LENGTH } from '../../../domain/record/payment'
import { moneyText } from '../../shared/money'

/**
 * 失敗を、Discord で読める日本語に直す。
 *
 * **ビューモデルのタグに対応する文言をここ 1 か所に持つ。** Web の文言（`adapter/web/presenter/message.ts`）
 * とは別に持つ。同じ失敗でも、行き先のあるリンクを添えられる Web と、チャンネルに 1 通だけ返す
 * Discord とでは言い方が変わるためである。**どちらもクライアント固有のものであり、
 * `adapter/shared` には置かない**（`docs/adr/0008-layer-internals.md`）。
 *
 * **上限の数値をここに打たない**（`CLAUDE.md`）。すべてドメイン層が公開する定数から取る。
 */

const amountLimit = () => {
  const jpy = currency('JPY')
  // 上限は通貨によらず「その通貨の最小単位で MONEY_MAX_AMOUNT」（`docs/domain/money.md`）。
  return jpy.ok ? moneyText(MONEY_MAX_AMOUNT, jpy.value).digits : String(MONEY_MAX_AMOUNT)
}

const MESSAGES = {
  // 前提条件を満たさなかったときの 3 区別（`docs/domain/group.md`）
  notAuthenticated: 'mmkn のアカウントが必要です。',
  notFound: '見つかりませんでした。',
  notMember: 'このグループのメンバーではありません。',

  // 外部サービスから届いた操作の解決（`docs/domain/group.md`）
  noAccount: 'mmkn のアカウントがまだありません。先に Web でアカウントを作ってください。',
  placeNotAssigned:
    'このチャンネルにグループが対応づけられていません。先に `/mmkn link` で対応づけてください。',

  // グループ
  groupNameEmpty: 'グループ名を入力してください。',
  groupNameTooLong: `グループ名は ${GROUP_NAME_MAX_LENGTH} 文字以内です。`,
  displayNameEmpty: '表示名を入力してください。',
  displayNameTooLong: `表示名は ${DISPLAY_NAME_MAX_LENGTH} 文字以内です。`,
  inviteCodeUnavailable: '招待リンクを作れませんでした。もう一度お試しください。',

  // 金額と通貨
  currencyUnsupported: 'この通貨は扱えません。',
  amountNotPositiveInteger: '金額を入力してください。',
  amountTooLarge: `1 件の上限は ${amountLimit()} です。`,

  // 発生日
  dateInvalid: '日付は YYYY-MM-DD の形で入力してください。',

  // 支払い
  payerNotMember: '支払った人を選んでください。',
  bearersEmpty: '負担する人を 1 人以上選んでください。',
  bearerDuplicated: '同じ人を重ねて選ぶことはできません。',
  bearerNotMember: '負担する人を選び直してください。',
  descriptionTooLong: `内容は ${DESCRIPTION_MAX_LENGTH} 文字以内です。`,

  // 送金
  senderNotMember: '送った人を選んでください。',
  recipientNotMember: '受け取った人を選んでください。',
  sameSenderAndRecipient: '送った人と受け取った人は別の人にしてください。',

  // 清算案（`docs/domain/settlement.md`「清算案の送金を記録する」）
  settlementChanged: '清算案が変わりました。この送金は、いまの清算案には含まれていません。',
} as const

/** 文言を持っている失敗のタグ。 */
export type FailureTag = keyof typeof MESSAGES

/**
 * 失敗を文言にする。
 *
 * 引数の型を `{ kind: FailureTag }` に絞ってあるため、**文言を持たない失敗は渡せない。**
 * ユースケースの失敗が増えたときは、ここに 1 行足すまで Presenter が通らない。
 */
export const messageOf = (error: { readonly kind: FailureTag }): string => MESSAGES[error.kind]

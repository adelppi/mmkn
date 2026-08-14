import {
  DISPLAY_NAME_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from '../../../domain/group/text'
import { MONEY_MAX_AMOUNT } from '../../../domain/money/money'
import { DESCRIPTION_MAX_LENGTH } from '../../../domain/record/payment'
import { moneyText } from '../../shared/money'
import { currency } from '../../../domain/money/currency'

/**
 * 失敗を、その場で読める日本語に直す（`docs/adr/0009-web-ui.md`「失敗の描画」）。
 *
 * **ビューモデルのタグに対応する文言をここ 1 か所に持つ。** Presentational は受け取った文字列を
 * 描くだけで、どの失敗が起きたかを判定しない。
 *
 * **上限の数値をここに打たない**（`CLAUDE.md`）。すべてドメイン層が公開する定数から取る。
 * 文言を足すのは失敗の種類が増えたときだけで、そのときは型検査が抜けを落とす（後述）。
 */

const amountLimit = () => {
  const jpy = currency('JPY')
  // 上限は通貨によらず「その通貨の最小単位で MONEY_MAX_AMOUNT」（`docs/domain/money.md`）。
  // 桁数が 0 の通貨で書くと、最小単位の数がそのまま読める。
  return jpy.ok ? moneyText(MONEY_MAX_AMOUNT, jpy.value).digits : String(MONEY_MAX_AMOUNT)
}

/**
 * 失敗のタグと文言の対応。
 *
 * **ユースケースの失敗はユースケースごとのタグ付き union である**（`docs/adr/0008`）ため、
 * ここは全ユースケース分の合併になる。`messageOf` が受け取れるのはここに載っているタグだけで、
 * **新しい失敗を足して文言を書き忘れると、Presenter の側が型検査で落ちる。**
 */
const MESSAGES = {
  // 前提条件を満たさなかったときの 3 区別（`docs/domain/group.md`）
  notAuthenticated: 'ログインが必要です。',
  notFound: '見つかりませんでした。',
  notMember: 'このグループのメンバーではありません。',

  // User の名前
  nameEmpty: '名前を入力してください。',
  nameTooLong: `名前は ${USER_NAME_MAX_LENGTH} 文字以内です。`,
  alreadyRegistered: 'このアカウントでは、すでに mmkn を使いはじめています。',

  // ログイン手段（`docs/domain/group.md`「User と外部アカウント」）
  usedByAnotherUser: 'このアカウントは、すでに別の人のログイン手段になっています。',
  serviceAlreadyUsed: 'このサービスのログイン手段は、すでに登録されています。',
  notALoginMethod: 'このサービスは、ログイン手段になっていません。',
  lastLoginMethod: '最後のログイン手段は削除できません。先に別の手段を追加してください。',

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
  dateInvalid: '日付を確認してください。',

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

  // 同時に手が入ったとき（`docs/domain/record.md`・`docs/domain/settlement.md`）
  versionConflict: 'この記録は他の人が更新しました。最新を読み込み直してからやり直してください。',
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

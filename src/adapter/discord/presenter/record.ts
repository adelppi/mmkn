import type { Group } from '../../../domain/group/group'
import { Member } from '../../../domain/group/member'
import type { MemberId } from '../../../domain/id'
import { Payment } from '../../../domain/record/payment'
import type { Transfer } from '../../../domain/record/transfer'
import { moneyText } from '../../shared/money'
import { customId, MEMBER_OPTIONS_FIELD } from '../definitions'
import {
  button,
  buttonRows,
  choice,
  done,
  embed,
  field,
  select,
  selectRow,
  type Reply,
} from './reply'

/**
 * 記録（支払い・送金）の表示（`docs/features.md` #5・#6）。
 *
 * **登録結果は公開で返る**（`docs/adr/0006-discord-http-interactions.md`「返信の可視性」）。
 * 入力途中のやり取りは実行者のみで、単位が分かれている。
 */

/**
 * Member の表示名。**読めなかったときも表示を止めない。**
 *
 * 記録そのものは成立しているのに名前だけが引けない場面（グループを読み直せなかったとき）で、
 * 「実行できませんでした」と嘘をつかないためである。
 */
export const nameOf = (group: Group | undefined, member: MemberId): string =>
  (group === undefined ? undefined : Member.byId(group.members, member))?.displayName ?? '（不明）'

/** その Group の Member を、セレクトの候補にする。**並びは表示名の昇順。** */
const memberChoices = (group: Group) =>
  [...group.members]
    .sort((a, b) => (a.displayName === b.displayName ? 0 : a.displayName < b.displayName ? -1 : 1))
    .map((member) => choice(member.id, member.displayName))

/**
 * 入力をひらく前の返信（**実行者のみ**）。
 *
 * **これが `docs/adr/0006`「負担者の選択とモーダルを直列にしない」の実現方法である。**
 * モーダルを開く応答は永続化に問い合わせられないため、候補となる Member の一覧を
 * **defer できるこのコマンドの側で引き**、押せないセレクトに載せて次の Interaction へ運ぶ。
 *
 * - 押せないため、**セレクトとモーダルを直列に繋ぐことにはならない**（選んでも Interaction は飛ばない）
 * - ボタンを押した Interaction には**元のメッセージが同梱される**ため、そこから候補を復元できる
 * - 運ぶのは候補（選択肢）であって、**書き込みの入力にする値ではない。** 実際に書き込まれるのは
 *   モーダルから返ってきた値であり、その妥当性はドメインが判定する
 */
const toInputReply = (input: {
  readonly group: Group
  readonly viewerMemberId: MemberId
  readonly currency: string
  readonly occurredOn: string
  readonly component: 'open-payment' | 'open-transfer'
  readonly title: string
  readonly description: string
}): Reply => ({
  embeds: [
    embed({
      title: input.title,
      description: input.description,
      tone: 'notice',
      fields: [field('グループ', input.group.name), field('通貨', input.currency)],
    }),
  ],
  components: [
    selectRow(
      select({
        customId: MEMBER_OPTIONS_FIELD,
        placeholder: 'メンバーは入力画面で選びます',
        options: memberChoices(input.group),
        // **運ぶためだけに置く。** 押せる状態にすると、確定を待つ中間状態が生まれる。
        disabled: true,
      }),
    ),
    ...buttonRows([
      button({
        /**
         * **対象の Group は載せない。** 場からその都度解決する（`docs/adr/0006`「対象 Group の解決」）。
         * 載せるのは、押した時点のペイロードからは作れないものだけである。
         */
        customId: customId(
          input.component,
          input.currency,
          input.occurredOn,
          input.viewerMemberId,
        ),
        label: '入力する',
        primary: true,
      }),
    ]),
  ],
})

export const toPaymentInputReply = (input: {
  readonly group: Group
  readonly viewerMemberId: MemberId
  readonly currency: string
  readonly occurredOn: string
}): Reply =>
  toInputReply({
    ...input,
    component: 'open-payment',
    title: '支払いを記録する',
    description: '「入力する」を押すと、金額・負担する人・内容をまとめて入力できます。',
  })

export const toTransferInputReply = (input: {
  readonly group: Group
  readonly viewerMemberId: MemberId
  readonly currency: string
  readonly occurredOn: string
}): Reply =>
  toInputReply({
    ...input,
    component: 'open-transfer',
    title: '送金を記録する',
    description: '「入力する」を押すと、送った人・受け取った人・金額をまとめて入力できます。',
  })

/**
 * 支払いを記録できたことを伝える（**公開**）。
 *
 * 負担額は `docs/domain/record.md`「負担額の配分」が定める配分をそのまま出す。
 * **端数の寄せ先は計算するたびに変わらない**ため、ここで並べても後から食い違わない。
 */
export const toPaymentReply = (group: Group | undefined, payment: Payment): Reply => {
  const shares = Payment.shares(payment)

  return done({
    title: '支払いを記録しました',
    fields: [
      field('金額', moneyText(payment.money.amount, payment.money.currency).text),
      field('支払った人', nameOf(group, payment.payer)),
      field(
        '負担する人',
        shares
          .map(
            (share) =>
              `${nameOf(group, share.bearer)} … ${moneyText(share.amount, payment.money.currency).text}`,
          )
          .join('\n'),
      ),
      field('発生日', payment.occurredOn),
      ...(payment.description === '' ? [] : [field('内容', payment.description)]),
    ],
  })
}

/**
 * 送金を記録できたことを伝える（**公開**）。
 *
 * **清算案から登録したものと、手で入力したものを区別しない**（`docs/domain/settlement.md`）。
 */
export const toTransferReply = (group: Group | undefined, transfer: Transfer): Reply =>
  done({
    title: '送金を記録しました',
    fields: [
      field('金額', moneyText(transfer.money.amount, transfer.money.currency).text),
      field('送った人', nameOf(group, transfer.sender)),
      field('受け取った人', nameOf(group, transfer.recipient)),
      field('発生日', transfer.occurredOn),
    ],
  })

import type {
  APIMessageComponentInteraction,
  APIModalInteractionResponseCallbackData,
} from 'discord-api-types/v10'
import { MEMBER_OPTIONS_FIELD } from '../../definitions'
import { carriedOptions } from '../../payload'
import { paymentModal, transferModal, type InputContext } from '../../presenter/modal'

/**
 * 入力のモーダルをひらく（`docs/adr/0006-discord-http-interactions.md`「モーダル」）。
 *
 * **この経路だけは defer による救済が効かない。** モーダルを開く応答は
 * `MESSAGE_COMPONENT` への初回応答としてしか送れず、3 秒以内に返しきる必要がある。
 * **したがってここは同期であり、ユースケースを 1 つも呼ばない。**
 *
 * 組み立てに要る値はすべて Interaction のペイロードから取る。
 *
 * | 値 | どこから |
 * |---|---|
 * | 負担者・送り手・受け手の候補 | 押されたメッセージに載っていた、押せないセレクトの選択肢 |
 * | 通貨・発生日の初期値・自分の Member | ボタンの `custom_id` |
 *
 * **対象の Group はここに現れない。** 場からその都度解決する（`docs/adr/0006`「対象 Group の解決」）。
 */

const inputContextOf = (
  interaction: APIMessageComponentInteraction,
  args: readonly string[],
): InputContext => {
  const [currency = '', occurredOn = '', actorMemberId = ''] = args

  return {
    currency,
    occurredOn,
    actorMemberId,
    members: carriedOptions(interaction, MEMBER_OPTIONS_FIELD),
  }
}

export const openPaymentModal = (
  interaction: APIMessageComponentInteraction,
  args: readonly string[],
): APIModalInteractionResponseCallbackData => paymentModal(inputContextOf(interaction, args))

export const openTransferModal = (
  interaction: APIMessageComponentInteraction,
  args: readonly string[],
): APIModalInteractionResponseCallbackData => transferModal(inputContextOf(interaction, args))

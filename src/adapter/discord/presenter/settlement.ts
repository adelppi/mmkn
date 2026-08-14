import type { APIEmbed } from 'discord-api-types/v10'
import type { Group } from '../../../domain/group/group'
import type { Currency } from '../../../domain/money/currency'
import type { Settlement } from '../../../domain/settlement/settlement'
import type { ViewSettlementOutput } from '../../../usecase/settlement/view-settlement'
import { currencyNameOf, moneyText } from '../../shared/money'
import { customId } from '../definitions'
import { button, buttonRows, embed, field, notice, type Reply } from './reply'
import { nameOf } from './record'

/**
 * 収支と清算案の表示（`docs/features.md` #8〜#10）。
 *
 * **どちらも保存しない**（`docs/domain/settlement.md`）。表示のたびにユースケースが記録から
 * 導出したものを整形するだけである。**収支・清算案は公開**（`docs/adr/0006`「返信の可視性」）。
 */

const currencyTitle = (currency: Currency): string =>
  `${currency} — ${currencyNameOf(currency)}`

// ── 収支 ─────────────────────────────────────────────────────────────────────

/**
 * 収支（`docs/domain/settlement.md`「収支」）。
 *
 * **収支が 0 の Member も落とさない**（同「境界・例外ケース」）。
 * 正が「受け取る側」、負が「支払う側」であることは符号でそのまま読める。
 */
export const toBalanceReply = (output: ViewSettlementOutput): Reply => {
  if (output.balances.length === 0) {
    return notice(`${output.group.name} の収支`, 'まだ記録がないため、収支はありません。')
  }

  return {
    embeds: output.balances.map(({ currency, balances }) =>
      embed({
        title: `${output.group.name} の収支`,
        description: currencyTitle(currency),
        tone: 'notice',
        fields: balances.map((balance) =>
          field(
            nameOf(output.group, balance.member),
            moneyText(balance.amount, currency, { signed: true }).text,
          ),
        ),
      }),
    ),
    components: [],
  }
}

// ── 清算案 ───────────────────────────────────────────────────────────────────

const settlementEmbed = (group: Group, settlement: Settlement): APIEmbed =>
  embed({
    title: `${group.name} の清算案`,
    description: currencyTitle(settlement.currency),
    tone: 'notice',
    fields: settlement.transfers.map((transfer) =>
      field(
        `${nameOf(group, transfer.sender)} → ${nameOf(group, transfer.recipient)}`,
        moneyText(transfer.amount, settlement.currency).text,
      ),
    ),
  })

/**
 * 清算案の「送金した」ボタン（`docs/adr/0006`「メッセージコンポーネント」）。
 *
 * **送り手を押下者に固定し、受け手と通貨だけを載せる。** `custom_id` は 100 文字が上限であり、
 * 操作対象の情報を持たせすぎない。**金額は載せない**（`docs/domain/settlement.md`：
 * 登録の時点で導出し直す）。
 *
 * 対象の Group を載せないのは、**場からその都度解決するため**である
 * （`docs/adr/0006`「対象 Group の解決」）。古いメッセージのボタンが、いまは別の Group に
 * 対応づけられたチャンネルで押されても、向く先はいまの対応先になる。
 *
 * ボタンは受け手ごとに 1 つで足りる。**押した人が送り手になる**ため、同じ受け手へ送る人が
 * 複数いても、それぞれが自分の額を登録できる。
 */
const settlementButtons = (group: Group, settlements: readonly Settlement[]) => {
  const seen = new Set<string>()

  return settlements.flatMap((settlement) =>
    settlement.transfers.flatMap((transfer) => {
      const key = `${transfer.recipient} ${settlement.currency}`
      if (seen.has(key)) return []
      seen.add(key)

      return [
        button({
          customId: customId('settle', transfer.recipient, settlement.currency),
          label: `${nameOf(group, transfer.recipient)} に送った（${settlement.currency}）`,
        }),
      ]
    }),
  )
}

/** 押した結果として、清算案の手前に添える 1 通。 */
export type SettlementHeadline = {
  readonly title: string
  readonly description: string
  readonly tone: 'done' | 'denied'
}

/**
 * 清算案（`docs/domain/settlement.md`「清算案」）。
 *
 * **ボタンで登録したあとも、これで描き直す。** 登録できた場合も、押した時点の清算案に
 * その送金が無かった場合も、いまの清算案に差し替える（`docs/adr/0006`）。
 * **送るお金が無くなればボタンは空になる**ため、古いボタンが残って何度も同じ失敗を踏むことがない。
 */
export const toSettlementReply = (
  output: ViewSettlementOutput,
  headline?: SettlementHeadline,
): Reply => {
  const head =
    headline === undefined
      ? []
      : [
          embed({
            title: headline.title,
            description: headline.description,
            tone: headline.tone,
          }),
        ]

  const remaining = output.settlements.filter((settlement) => settlement.transfers.length > 0)

  if (remaining.length === 0) {
    return {
      embeds: [
        ...head,
        embed({
          title: `${output.group.name} の清算案`,
          description: '送る必要のあるお金はありません。',
          tone: 'notice',
        }),
      ],
      // **部品を空で明示的に送る**（`docs/adr/0006`）。省くと古いボタンが残る。
      components: [],
    }
  }

  return {
    embeds: [...head, ...remaining.map((settlement) => settlementEmbed(output.group, settlement))],
    components: buttonRows(settlementButtons(output.group, remaining)),
  }
}

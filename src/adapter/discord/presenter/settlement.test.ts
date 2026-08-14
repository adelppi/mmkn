import { describe, expect, it } from 'vitest'
import { toMemberId, type MemberId } from '../../../domain/id'
import { currency, type Currency } from '../../../domain/money/currency'
import type { CurrencyBalances } from '../../../domain/settlement/balance'
import type { Settlement } from '../../../domain/settlement/settlement'
import { groupOf, hanako, jiro, taro } from '../../../usecase/fixture'
import type { ViewSettlementOutput } from '../../../usecase/settlement/view-settlement'
import { parseCustomId } from '../definitions'
import { MAX_BUTTONS } from './limits'
import { toBalanceReply, toSettlementReply } from './settlement'

/**
 * 収支と清算案の表示（`docs/domain/settlement.md`・
 * `docs/adr/0006-discord-http-interactions.md`「メッセージコンポーネント」「構造上の制約」）。
 */

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
  { user: hanako, memberId: 'm3' },
])

const jpy = (() => {
  const result = currency('JPY')
  if (!result.ok) throw new Error('前提の通貨が表に無い')
  return result.value
})()

const m = (id: string): MemberId => toMemberId(id)

const output = (input: {
  balances?: readonly CurrencyBalances[]
  settlements?: readonly Settlement[]
}): ViewSettlementOutput => ({
  group,
  balances: input.balances ?? [],
  settlements: input.settlements ?? [],
})

const settlementOf = (
  transfers: readonly { sender: MemberId; recipient: MemberId; amount: number }[],
  code: Currency = jpy,
): Settlement => ({ currency: code, transfers })

const buttonsOf = (reply: { components: readonly { components: readonly unknown[] }[] }) =>
  reply.components.flatMap((row) => row.components) as { custom_id: string; label: string }[]

describe('収支', () => {
  it('通貨ごとに、Member の過不足が符号つきで並ぶ', () => {
    const reply = toBalanceReply(
      output({
        balances: [
          {
            currency: jpy,
            balances: [
              { member: m('m1'), amount: 5_000 },
              { member: m('m2'), amount: -5_000 },
            ],
          },
        ],
      }),
    )

    expect(reply.embeds[0]?.fields?.map((it) => [it.name, it.value])).toEqual([
      ['たろう', '+￥ 5,000'],
      ['じろう', '−￥ 5,000'],
    ])
  })

  it('過不足が 0 の Member も落とさない', () => {
    const reply = toBalanceReply(
      output({ balances: [{ currency: jpy, balances: [{ member: m('m1'), amount: 0 }] }] }),
    )

    expect(reply.embeds[0]?.fields).toHaveLength(1)
  })

  it('記録が無ければ、収支は無いと伝える', () => {
    const reply = toBalanceReply(output({}))

    expect(reply.embeds[0]?.description).toContain('まだ記録がない')
  })

  it('収支には部品を付けない', () => {
    const reply = toBalanceReply(
      output({ balances: [{ currency: jpy, balances: [{ member: m('m1'), amount: 1 }] }] }),
    )

    expect(reply.components).toEqual([])
  })
})

describe('清算案', () => {
  it('送金が「誰から誰へ・いくら」として並ぶ', () => {
    const reply = toSettlementReply(
      output({
        settlements: [settlementOf([{ sender: m('m2'), recipient: m('m1'), amount: 5_000 }])],
      }),
    )

    expect(reply.embeds[0]?.fields?.[0]).toMatchObject({
      name: 'じろう → たろう',
      value: '￥ 5,000',
    })
  })

  it('ボタンは受け手と通貨だけを載せる（送り手は押下者に固定する）', () => {
    const reply = toSettlementReply(
      output({
        settlements: [settlementOf([{ sender: m('m2'), recipient: m('m1'), amount: 5_000 }])],
      }),
    )

    expect(parseCustomId(buttonsOf(reply)[0]!.custom_id)).toEqual({
      name: 'settle',
      args: ['m1', 'JPY'],
    })
  })

  it('金額はボタンに載せない（登録の時点で導出し直すため）', () => {
    const reply = toSettlementReply(
      output({
        settlements: [settlementOf([{ sender: m('m2'), recipient: m('m1'), amount: 5_000 }])],
      }),
    )

    expect(buttonsOf(reply)[0]!.custom_id).not.toContain('5000')
  })

  it('同じ受け手へ送る人が複数いても、ボタンは 1 つで足りる', () => {
    const reply = toSettlementReply(
      output({
        settlements: [
          settlementOf([
            { sender: m('m2'), recipient: m('m1'), amount: 5_000 },
            { sender: m('m3'), recipient: m('m1'), amount: 3_000 },
          ]),
        ],
      }),
    )

    expect(buttonsOf(reply)).toHaveLength(1)
  })

  it('送るお金が無ければ、部品を空で明示的に返す（古いボタンを残さない）', () => {
    const reply = toSettlementReply(output({ settlements: [settlementOf([])] }))

    expect(reply.components).toEqual([])
    expect(reply.embeds.at(-1)?.description).toContain('送る必要のあるお金はありません')
  })

  it('ボタンが 25 個を超えたら切り詰める', () => {
    const transfers = Array.from({ length: MAX_BUTTONS + 5 }, (_, i) => ({
      sender: m('m1'),
      recipient: m(`x${i}`),
      amount: 100,
    }))

    const reply = toSettlementReply(output({ settlements: [settlementOf(transfers)] }))

    expect(buttonsOf(reply)).toHaveLength(MAX_BUTTONS)
  })

  it('押した結果は、描き直した清算案の手前に添える', () => {
    const reply = toSettlementReply(
      output({
        settlements: [settlementOf([{ sender: m('m2'), recipient: m('m1'), amount: 2_000 }])],
      }),
      { title: '送金を記録しました', description: '￥ 3,000', tone: 'done' },
    )

    expect(reply.embeds[0]?.title).toBe('送金を記録しました')
    expect(reply.embeds[1]?.fields?.[0]?.value).toBe('￥ 2,000')
  })

  it('送金を記録して送るお金が無くなったら、ボタンも消える', () => {
    const reply = toSettlementReply(output({ settlements: [settlementOf([])] }), {
      title: '送金を記録しました',
      description: '￥ 5,000',
      tone: 'done',
    })

    expect(reply.components).toEqual([])
  })
})

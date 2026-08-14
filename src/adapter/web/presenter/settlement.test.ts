import { describe, expect, it } from 'vitest'
import { toMemberId, toTransferId } from '../../../domain/id'
import { currency, type Currency } from '../../../domain/money/currency'
import { Transfer } from '../../../domain/record/transfer'
import { err, ok } from '../../../domain/result'
import { groupOf, jiro, taro } from '../../../usecase/fixture'
import {
  toBalanceView,
  toSettlementTransferView,
  toSettlementView,
  toViewerBalanceView,
} from './settlement'

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

const jpy = (() => {
  const result = currency('JPY')
  if (!result.ok) throw new Error('前提の通貨が表に無い')
  return result.value
})()

const m1 = toMemberId('m1')
const m2 = toMemberId('m2')

const output = (input: {
  balances?: readonly { currency: Currency; balances: readonly { member: typeof m1; amount: number }[] }[]
  settlements?: readonly {
    currency: Currency
    transfers: readonly { sender: typeof m1; recipient: typeof m1; amount: number }[]
  }[]
}) =>
  ok({
    group,
    balances: input.balances ?? [],
    settlements: input.settlements ?? [],
  })

describe('収支', () => {
  it('通貨ごとに、Member の過不足が並ぶ', () => {
    const view = toBalanceView('m1', output({
      balances: [
        {
          currency: jpy,
          balances: [
            { member: m1, amount: 5_000 },
            { member: m2, amount: -5_000 },
          ],
        },
      ],
    }))

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    expect(view.currencies[0]?.currency).toBe('JPY')
    expect(view.currencies[0]?.currencyLabel).toBe('日本円')
    expect(view.currencies[0]?.rows.map((row) => row.money.sign)).toEqual(['+', '−'])
    expect(view.currencies[0]?.rows.map((row) => row.isViewer)).toEqual([true, false])
  })

  it('過不足が 0 の Member も落とさない', () => {
    const view = toBalanceView('m1', output({
      balances: [{ currency: jpy, balances: [{ member: m1, amount: 0 }] }],
    }))

    expect(view.kind === 'ok' && view.currencies[0]?.rows).toHaveLength(1)
  })

  it('記録が無ければ空のタグになる', () => {
    expect(toBalanceView('m1', output({})).kind).toBe('empty')
  })

  it('Member でなければ中身は返らない', () => {
    expect(toBalanceView(undefined, err({ kind: 'notMember' })).kind).toBe('notMember')
  })
})

describe('あなたの収支', () => {
  it('自分の分だけが「受け取る／支払う」で出る', () => {
    const view = toViewerBalanceView('m1', output({
      balances: [
        {
          currency: jpy,
          balances: [
            { member: m1, amount: 14_800 },
            { member: m2, amount: -14_800 },
          ],
        },
      ],
    }))

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    expect(view.rows).toHaveLength(1)
    expect(view.rows[0]?.label).toBe('受け取る')
  })

  it('過不足が無ければ、その旨が出る', () => {
    const view = toViewerBalanceView('m1', output({
      balances: [{ currency: jpy, balances: [{ member: m1, amount: 0 }] }],
    }))

    expect(view.kind).toBe('even')
  })
})

describe('清算案', () => {
  it('通貨ごとに件数と行が並ぶ', () => {
    const view = toSettlementView(output({
      settlements: [
        { currency: jpy, transfers: [{ sender: m2, recipient: m1, amount: 5_000 }] },
      ],
    }))

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    expect(view.currencies[0]?.countLabel).toBe('1 件')
    expect(view.currencies[0]?.rows[0]).toMatchObject({
      senderName: 'じろう',
      recipientName: 'たろう',
      actionLabel: '送金した',
    })
  })

  it('金額を入力しないことが画面に書かれている', () => {
    const view = toSettlementView(output({
      settlements: [
        { currency: jpy, transfers: [{ sender: m2, recipient: m1, amount: 5_000 }] },
      ],
    }))

    expect(view.kind === 'ok' && view.note).toContain('金額の入力はありません')
  })

  it('送るお金が無ければ、その旨が出る', () => {
    const view = toSettlementView(output({ settlements: [{ currency: jpy, transfers: [] }] }))

    expect(view.kind).toBe('settled')
  })

  it('Member でなければ中身は返らない', () => {
    expect(toSettlementView(err({ kind: 'notMember' })).kind).toBe('notMember')
  })
})

describe('清算案からの送金記録', () => {
  const transfer = (() => {
    const result = Transfer.create({
      id: toTransferId('t1'),
      group,
      sender: m2,
      recipient: m1,
      amount: 5_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      recordedBy: jiro.id,
      recordedAt: new Date('2026-08-14T00:00:00.000Z'),
    })
    if (!result.ok) throw new Error('前提の Transfer を作れなかった')
    return result.value
  })()

  it('実際に記録された額が伝わる', () => {
    const view = toSettlementTransferView('g1', ok({ record: transfer, version: 1 }))

    expect(view.kind).toBe('registered')
    expect(view.kind === 'registered' && view.message).toContain('5,000')
  })

  it('清算案が変わっていたら、最新を見る導線が出る', () => {
    const view = toSettlementTransferView('g1', err({ kind: 'settlementChanged' }))

    expect(view.kind).toBe('changed')
    expect(view.kind === 'changed' && view.reloadHref).toBe('/groups/g1/settlement')
  })

  it('Member でなければ失敗として出る', () => {
    const view = toSettlementTransferView('g1', err({ kind: 'notMember' }))

    expect(view.kind).toBe('failed')
  })
})

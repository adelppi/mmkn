import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  initialSettlementTransferView,
  toSettlementTransferView,
  toSettlementView,
} from '@/src/adapter/web/presenter/settlement'
import { toMemberId, toTransferId } from '@/src/domain/id'
import { currency, type Currency } from '@/src/domain/money/currency'
import { Transfer } from '@/src/domain/record/transfer'
import { err, ok } from '@/src/domain/result'
import { groupOf, hanako, jiro, taro } from '@/src/usecase/fixture'
import { SettlementListPresentation } from './presentation'

/**
 * 精算（設計 05）。
 *
 * **「送金した」は金額を送らない**（`docs/domain/settlement.md`）。押した時点の清算案に
 * その送金が無かったときの失敗も、分岐として並べる。
 */
const meta = {
  component: SettlementListPresentation,
  args: {
    groupId: 'g1',
    action: async (previous) => previous,
    initial: initialSettlementTransferView(),
  },
} satisfies Meta<typeof SettlementListPresentation>

export default meta
type Story = StoryObj<typeof meta>

const group = groupOf([
  { user: taro, memberId: 'm1', displayName: 'あきら' },
  { user: jiro, memberId: 'm2', displayName: 'みなみ' },
  { user: hanako, memberId: 'm3', displayName: 'ゆう' },
])

const of = (code: string): Currency => {
  const result = currency(code)
  if (!result.ok) throw new Error('前提の通貨が表に無い')
  return result.value
}

const m1 = toMemberId('m1')
const m2 = toMemberId('m2')
const m3 = toMemberId('m3')

const settlements = ok({
  group,
  balances: [],
  settlements: [
    {
      currency: of('JPY'),
      transfers: [
        { sender: m2, recipient: m3, amount: 57_200 },
        { sender: m2, recipient: m1, amount: 14_800 },
      ],
    },
    { currency: of('TWD'), transfers: [{ sender: m1, recipient: m2, amount: 295 }] },
  ],
})

const registered = (() => {
  const result = Transfer.create({
    id: toTransferId('t1'),
    group,
    sender: m2,
    recipient: m3,
    amount: 57_200,
    currency: 'JPY',
    occurredOn: '2026-08-14',
    recordedBy: jiro.id,
    recordedAt: new Date('2026-08-14T00:00:00.000Z'),
  })
  if (!result.ok) throw new Error('前提の Transfer を作れなかった')
  return { record: result.value, version: 1 }
})()

export const 送るお金がある: Story = { args: toSettlementView(settlements) }

export const 記録できた: Story = {
  args: {
    ...toSettlementView(settlements),
    initial: toSettlementTransferView('g1', ok(registered)),
  },
}

/** 表示から登録までの間に記録が変わっていた（`docs/domain/settlement.md`）。 */
export const 清算案が変わっていた: Story = {
  args: {
    ...toSettlementView(settlements),
    initial: toSettlementTransferView('g1', err({ kind: 'settlementChanged' })),
  },
}

export const 送るお金がない: Story = {
  args: toSettlementView(
    ok({ group, balances: [], settlements: [{ currency: of('JPY'), transfers: [] }] }),
  ),
}

export const 未ログイン: Story = { args: toSettlementView(err({ kind: 'notAuthenticated' })) }

export const 見つからない: Story = { args: toSettlementView(err({ kind: 'notFound' })) }

export const メンバーでない: Story = { args: toSettlementView(err({ kind: 'notMember' })) }

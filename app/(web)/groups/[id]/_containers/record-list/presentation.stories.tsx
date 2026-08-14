import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toRecordListView } from '@/src/adapter/web/presenter/record'
import { toMemberId, toPaymentId, toTransferId } from '@/src/domain/id'
import { Payment } from '@/src/domain/record/payment'
import type { AnyRecord } from '@/src/domain/record/record'
import { Transfer } from '@/src/domain/record/transfer'
import { err, ok } from '@/src/domain/result'
import { groupOf, hanako, jiro, taro } from '@/src/usecase/fixture'
import type { Versioned } from '@/src/usecase/usecase'
import { RecordListPresentation } from './presentation'

/**
 * 記録一覧（設計 03）。
 *
 * **Payment と Transfer をまとめて 1 つの列にする**（`docs/domain/record.md`「記録の並び」）。
 */
const meta = {
  component: RecordListPresentation,
} satisfies Meta<typeof RecordListPresentation>

export default meta
type Story = StoryObj<typeof meta>

const group = groupOf(
  [
    { user: taro, memberId: 'm1', displayName: 'あきら' },
    { user: jiro, memberId: 'm2', displayName: 'みなみ' },
    { user: hanako, memberId: 'm3', displayName: 'ゆう' },
  ],
  { name: '台湾旅行' },
)

const at = new Date('2026-08-14T00:00:00.000Z')

const payment = (input: {
  id: string
  amount: number
  currency: string
  occurredOn: string
  description: string
  bearers?: readonly string[]
}): Payment => {
  const result = Payment.create({
    id: toPaymentId(input.id),
    group,
    payer: toMemberId('m2'),
    bearers: (input.bearers ?? ['m1', 'm2', 'm3']).map(toMemberId),
    amount: input.amount,
    currency: input.currency,
    occurredOn: input.occurredOn,
    description: input.description,
    recordedBy: jiro.id,
    recordedAt: at,
  })
  if (!result.ok) throw new Error('前提の Payment を作れなかった')
  return result.value
}

const transfer = (): Transfer => {
  const result = Transfer.create({
    id: toTransferId('t1'),
    group,
    sender: toMemberId('m3'),
    recipient: toMemberId('m1'),
    amount: 12_000,
    currency: 'JPY',
    occurredOn: '2026-08-08',
    recordedBy: hanako.id,
    recordedAt: at,
  })
  if (!result.ok) throw new Error('前提の Transfer を作れなかった')
  return result.value
}

const listed = (records: readonly AnyRecord[]) =>
  ok({
    group,
    records: records.map((record): Versioned<AnyRecord> => ({ record, version: 1 })),
  })

export const 記録がある: Story = {
  args: toRecordListView(
    listed([
      payment({ id: 'p1', amount: 124_000, currency: 'TWD', occurredOn: '2026-08-09', description: '夜市' }),
      payment({
        id: 'p2',
        amount: 48_000,
        currency: 'TWD',
        occurredOn: '2026-08-09',
        description: 'タクシー',
        bearers: ['m1', 'm2'],
      }),
      payment({
        id: 'p3',
        amount: 48_000,
        currency: 'JPY',
        occurredOn: '2026-08-08',
        description: 'ホテル 2泊',
      }),
      transfer(),
    ]),
  ),
}

/** 内容は任意（`docs/domain/record.md`）。空のときに何と出すかは画面側の問題。 */
export const 内容が空: Story = {
  args: toRecordListView(
    listed([
      payment({ id: 'p1', amount: 3_000, currency: 'JPY', occurredOn: '2026-08-09', description: '' }),
    ]),
  ),
}

/** 年が変わると見出しに年が付く。 */
export const 年をまたぐ: Story = {
  args: toRecordListView(
    listed([
      payment({ id: 'p1', amount: 3_000, currency: 'JPY', occurredOn: '2026-01-02', description: '初詣' }),
      payment({ id: 'p2', amount: 9_800, currency: 'JPY', occurredOn: '2025-12-31', description: '年越し' }),
    ]),
  ),
}

export const 記録がない: Story = { args: toRecordListView(listed([])) }

export const 未ログイン: Story = { args: toRecordListView(err({ kind: 'notAuthenticated' })) }

export const 見つからない: Story = { args: toRecordListView(err({ kind: 'notFound' })) }

export const メンバーでない: Story = { args: toRecordListView(err({ kind: 'notMember' })) }

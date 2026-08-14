import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  emptyRecordForm,
  initialRecordFormView,
  toRecordDetailView,
  toRecordFormView,
  recordFormFields,
} from '@/src/adapter/web/presenter/record'
import { toMemberId, toPaymentId, toTransferId } from '@/src/domain/id'
import { Payment } from '@/src/domain/record/payment'
import type { AnyRecord } from '@/src/domain/record/record'
import { Transfer } from '@/src/domain/record/transfer'
import { err, ok } from '@/src/domain/result'
import { groupOf, hanako, jiro, taro } from '@/src/usecase/fixture'
import type { Versioned } from '@/src/usecase/usecase'
import { RecordDetailPresentation } from './presentation'

/**
 * 記録の詳細（設計 08）。
 *
 * **負担額は保存せず導出する**（`docs/domain/record.md`「負担額の配分」）。
 * 端数が配分順序の先頭に寄ることも、ここで目で確かめられる。
 */
const meta = {
  component: RecordDetailPresentation,
  args: {
    deleteAction: async (previous) => previous,
    deleteInitial: initialRecordFormView(emptyRecordForm('g1', 'payment')),
    editHref: '/groups/g1/records/p1/edit',
  },
} satisfies Meta<typeof RecordDetailPresentation>

export default meta
type Story = StoryObj<typeof meta>

const group = groupOf([
  { user: taro, memberId: 'm1', displayName: 'あきら' },
  { user: jiro, memberId: 'm2', displayName: 'みなみ' },
  { user: hanako, memberId: 'm3', displayName: 'ゆう' },
])

const at = new Date('2026-08-14T00:00:00.000Z')

const paymentOf = (amount: number, description: string): Payment => {
  const result = Payment.create({
    id: toPaymentId('p1'),
    group,
    payer: toMemberId('m1'),
    bearers: [toMemberId('m1'), toMemberId('m2'), toMemberId('m3')],
    amount,
    currency: 'JPY',
    occurredOn: '2026-08-08',
    description,
    recordedBy: taro.id,
    recordedAt: at,
  })
  if (!result.ok) throw new Error('前提の Payment を作れなかった')
  return result.value
}

const transferOf = (): Transfer => {
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

export const 支払い: Story = {
  args: toRecordDetailView('p1', listed([paymentOf(48_000, 'ホテル 2泊')])),
}

/** 割り切れないときは、配分順序の先頭から 1 単位ずつ（`docs/domain/record.md`）。 */
export const 端数がある支払い: Story = {
  args: toRecordDetailView('p1', listed([paymentOf(10_001, '夕食')])),
}

export const 内容が空の支払い: Story = {
  args: toRecordDetailView('p1', listed([paymentOf(3_000, '')])),
}

export const 送金: Story = {
  args: {
    ...toRecordDetailView('t1', listed([transferOf()])),
    editHref: '/groups/g1/records/t1/edit',
  },
}

/** 削除も、見ていた版で通らなければ失敗する（`docs/adr/0005`）。 */
export const 削除が競合した: Story = {
  args: {
    ...toRecordDetailView('p1', listed([paymentOf(48_000, 'ホテル 2泊')])),
    deleteInitial: toRecordFormView(
      recordFormFields(group, [], { type: 'payment', recordId: 'p1', version: 1 }),
      err({ kind: 'versionConflict' }),
    ),
  },
}

export const 見つからない: Story = {
  args: toRecordDetailView('missing', listed([])),
}

export const メンバーでない: Story = {
  args: toRecordDetailView('p1', err({ kind: 'notMember' })),
}

export const 未ログイン: Story = {
  args: toRecordDetailView('p1', err({ kind: 'notAuthenticated' })),
}

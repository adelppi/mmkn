import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  initialRecordFormView,
  recordFormFields,
  toRecordFormView,
} from '@/src/adapter/web/presenter/record'
import { currency, type Currency } from '@/src/domain/money/currency'
import { err } from '@/src/domain/result'
import { groupOf, hanako, jiro, taro } from '@/src/usecase/fixture'
import { RecordFormPresentation } from './presentation'

/**
 * 記録の登録・編集（設計 06・07）。
 *
 * **入力の不備はサーバーから戻る**（`docs/adr/0009-web-ui.md`）。画面側に業務ルールが無いことを、
 * 「押せる状態のまま失敗が返る」形として並べて確かめる。
 */
const meta = {
  component: RecordFormPresentation,
  args: { action: async (previous) => previous },
} satisfies Meta<typeof RecordFormPresentation>

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

const recorded = [of('JPY'), of('TWD')]

const paymentForm = recordFormFields(group, recorded, { type: 'payment' })
const transferForm = recordFormFields(group, recorded, { type: 'transfer' })
const editForm = recordFormFields(group, recorded, {
  type: 'payment',
  recordId: 'p1',
  version: 3,
  amount: '48000',
  currency: 'JPY',
  payer: 'm1',
  bearers: ['m1', 'm2', 'm3'],
  occurredOn: '2026-08-08',
  description: 'ホテル 2泊',
})

export const 支払いを登録: Story = { args: initialRecordFormView(paymentForm) }

export const 送金を登録: Story = { args: initialRecordFormView(transferForm) }

export const 編集: Story = { args: initialRecordFormView(editForm) }

/** **負担する人は 1 人以上**（`docs/domain/record.md`「支払者と負担者」）。 */
export const 負担する人がいない: Story = {
  args: toRecordFormView(paymentForm, err({ kind: 'bearersEmpty' })),
}

/** 上限は 1 件ごとに見る（`docs/domain/money.md`「金額の上限」）。 */
export const 金額が上限を超えた: Story = {
  args: toRecordFormView(paymentForm, err({ kind: 'amountTooLarge' })),
}

export const 金額が入っていない: Story = {
  args: toRecordFormView(paymentForm, err({ kind: 'amountNotPositiveInteger' })),
}

export const 扱えない通貨: Story = {
  args: toRecordFormView(paymentForm, err({ kind: 'currencyUnsupported' })),
}

export const 内容が長すぎる: Story = {
  args: toRecordFormView(paymentForm, err({ kind: 'descriptionTooLong' })),
}

export const 日付が読めない: Story = {
  args: toRecordFormView(paymentForm, err({ kind: 'dateInvalid' })),
}

/** 送り手と受け手は別の人（`docs/domain/record.md`「ルール」）。 */
export const 送り手と受け手が同じ: Story = {
  args: toRecordFormView(transferForm, err({ kind: 'sameSenderAndRecipient' })),
}

/** **後から届いた変更は失敗する**（`docs/domain/record.md`「同じ記録に同時に手が入ったとき」）。 */
export const 同時に編集された: Story = {
  args: toRecordFormView(editForm, err({ kind: 'versionConflict' })),
}

export const メンバーでない: Story = {
  args: toRecordFormView(paymentForm, err({ kind: 'notMember' })),
}

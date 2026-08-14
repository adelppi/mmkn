import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toViewerBalanceView } from '@/src/adapter/web/presenter/settlement'
import { toMemberId } from '@/src/domain/id'
import { currency, type Currency } from '@/src/domain/money/currency'
import { err, ok } from '@/src/domain/result'
import { groupOf, jiro, taro } from '@/src/usecase/fixture'
import { ViewerBalancePresentation } from './presentation'

/** あなたの収支（設計 03 の上部）。 */
const meta = {
  component: ViewerBalancePresentation,
} satisfies Meta<typeof ViewerBalancePresentation>

export default meta
type Story = StoryObj<typeof meta>

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

const of = (code: string): Currency => {
  const result = currency(code)
  if (!result.ok) throw new Error('前提の通貨が表に無い')
  return result.value
}

const m1 = toMemberId('m1')
const m2 = toMemberId('m2')

export const 受け取る: Story = {
  args: toViewerBalanceView(
    'm1',
    ok({
      group,
      balances: [
        {
          currency: of('JPY'),
          balances: [
            { member: m1, amount: 14_800 },
            { member: m2, amount: -14_800 },
          ],
        },
      ],
      settlements: [],
    }),
  ),
}

/** **通貨をまたいで合算しない**（`docs/domain/money.md`）。通貨ごとに 1 行ずつ並ぶ。 */
export const 通貨が複数: Story = {
  args: toViewerBalanceView(
    'm1',
    ok({
      group,
      balances: [
        { currency: of('JPY'), balances: [{ member: m1, amount: 14_800 }] },
        { currency: of('TWD'), balances: [{ member: m1, amount: -295 }] },
      ],
      settlements: [],
    }),
  ),
}

export const 過不足がない: Story = {
  args: toViewerBalanceView(
    'm1',
    ok({
      group,
      balances: [{ currency: of('JPY'), balances: [{ member: m1, amount: 0 }] }],
      settlements: [],
    }),
  ),
}

/** 読めなかった理由は上端が伝えるため、ここは何も出さない。 */
export const メンバーでない: Story = {
  args: toViewerBalanceView(undefined, err({ kind: 'notMember' })),
}

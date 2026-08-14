import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toBalanceView } from '@/src/adapter/web/presenter/settlement'
import { toMemberId } from '@/src/domain/id'
import { currency, type Currency } from '@/src/domain/money/currency'
import { err, ok } from '@/src/domain/result'
import { groupOf, hanako, jiro, taro } from '@/src/usecase/fixture'
import { BalanceListPresentation } from './presentation'

/**
 * 収支（設計 04）。
 *
 * **通貨ごとに独立して並ぶ**（`docs/domain/money.md`「通貨をまたがない」）。
 */
const meta = {
  component: BalanceListPresentation,
} satisfies Meta<typeof BalanceListPresentation>

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

export const 通貨がひとつ: Story = {
  args: toBalanceView(
    'm1',
    ok({
      group,
      balances: [
        {
          currency: of('JPY'),
          balances: [
            { member: m1, amount: 14_800 },
            { member: m2, amount: -45_200 },
            { member: m3, amount: 30_400 },
          ],
        },
      ],
      settlements: [],
    }),
  ),
}

export const 通貨が複数: Story = {
  args: toBalanceView(
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
        {
          currency: of('TWD'),
          balances: [
            { member: m1, amount: -295 },
            { member: m2, amount: 295 },
          ],
        },
      ],
      settlements: [],
    }),
  ),
}

/** **収支が 0 の Member も落とさない**（`docs/domain/settlement.md`「境界・例外ケース」）。 */
export const 過不足がない人がいる: Story = {
  args: toBalanceView(
    'm1',
    ok({
      group,
      balances: [
        {
          currency: of('JPY'),
          balances: [
            { member: m1, amount: 0 },
            { member: m2, amount: -5_000 },
            { member: m3, amount: 5_000 },
          ],
        },
      ],
      settlements: [],
    }),
  ),
}

export const 記録がない: Story = {
  args: toBalanceView('m1', ok({ group, balances: [], settlements: [] })),
}

export const 未ログイン: Story = { args: toBalanceView(undefined, err({ kind: 'notAuthenticated' })) }

export const 見つからない: Story = { args: toBalanceView(undefined, err({ kind: 'notFound' })) }

export const メンバーでない: Story = { args: toBalanceView(undefined, err({ kind: 'notMember' })) }

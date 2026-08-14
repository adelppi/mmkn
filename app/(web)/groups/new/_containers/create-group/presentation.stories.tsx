import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { initialCreateGroupView, toCreateGroupView } from '@/src/adapter/web/presenter/group'
import { err, ok } from '@/src/domain/result'
import { groupOf, taro } from '@/src/usecase/fixture'
import { CreateGroupPresentation } from './presentation'

/** グループ作成（設計 09）。 */
const meta = {
  component: CreateGroupPresentation,
  args: { action: async (previous) => previous, groupsHref: '/' },
} satisfies Meta<typeof CreateGroupPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const 入力前: Story = { args: initialCreateGroupView('JPY') }

export const 名前が空: Story = {
  args: toCreateGroupView(
    { name: '  ', defaultCurrency: 'JPY' },
    err({ kind: 'groupNameEmpty' }),
  ),
}

export const 名前が長すぎる: Story = {
  args: toCreateGroupView(
    { name: 'あ'.repeat(60), defaultCurrency: 'JPY' },
    err({ kind: 'groupNameTooLong' }),
  ),
}

/** 扱えない通貨は既定通貨にもできない（`docs/domain/money.md`）。 */
export const 扱えない通貨: Story = {
  args: toCreateGroupView(
    { name: '台湾旅行', defaultCurrency: 'XAU' },
    err({ kind: 'currencyUnsupported' }),
  ),
}

export const 作成できた: Story = {
  args: toCreateGroupView(
    { name: '台湾旅行', defaultCurrency: 'JPY' },
    ok(groupOf([{ user: taro, memberId: 'm1' }], { name: '台湾旅行' })),
  ),
}

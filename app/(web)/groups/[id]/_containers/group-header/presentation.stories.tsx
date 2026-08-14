import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toGroupHeaderView } from '@/src/adapter/web/presenter/group'
import { err, ok } from '@/src/domain/result'
import { groupOf, jiro, taro } from '@/src/usecase/fixture'
import { GroupHeaderPresentation } from './presentation'

/**
 * グループの上端（設計 03〜05）。
 *
 * **前提条件を満たさなかった 3 区別**（未ログイン／見つからない／Member でない）を並べる
 * （`docs/domain/group.md`「前提条件を満たさなかったとき」）。
 */
const meta = {
  component: GroupHeaderPresentation,
} satisfies Meta<typeof GroupHeaderPresentation>

export default meta
type Story = StoryObj<typeof meta>

const group = groupOf(
  [
    { user: taro, memberId: 'm1' },
    { user: jiro, memberId: 'm2' },
  ],
  { name: '台湾旅行' },
)

const viewer = group.members[0]
if (viewer === undefined) throw new Error('前提の Member が無い')

export const 記録タブ: Story = {
  args: toGroupHeaderView('records', ok({ group, viewer })),
}

export const 収支タブ: Story = {
  args: toGroupHeaderView('balances', ok({ group, viewer })),
}

export const 精算タブ: Story = {
  args: toGroupHeaderView('settlement', ok({ group, viewer })),
}

export const 未ログイン: Story = {
  args: toGroupHeaderView('records', err({ kind: 'notAuthenticated' })),
}

export const 見つからない: Story = {
  args: toGroupHeaderView('records', err({ kind: 'notFound' })),
}

export const メンバーでない: Story = {
  args: toGroupHeaderView('records', err({ kind: 'notMember' })),
}

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
 *
 * **どのタブを選んでいるかはここに出ない。** 選択はいまの場所から決まるため
 * （`app/_ui/tab-bar.tsx`）、props だけでは再現できない。
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

export const 上端: Story = {
  args: toGroupHeaderView(ok({ group, viewer })),
}

export const 未ログイン: Story = {
  args: toGroupHeaderView(err({ kind: 'notAuthenticated' })),
}

export const 見つからない: Story = {
  args: toGroupHeaderView(err({ kind: 'notFound' })),
}

export const メンバーでない: Story = {
  args: toGroupHeaderView(err({ kind: 'notMember' })),
}

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { initialJoinView, toInviteView, toJoinView } from '@/src/adapter/web/presenter/group'
import { err, ok } from '@/src/domain/result'
import { groupOf, hanako, jiro, taro } from '@/src/usecase/fixture'
import { InvitePresentation } from './presentation'

/**
 * 招待リンクから参加（設計 10）。
 *
 * **参加する前に見えるのはグループ名と Member の表示名まで**
 * （`docs/domain/group.md`「グループに参加する」）。
 */
const meta = {
  component: InvitePresentation,
  args: {
    action: async (previous) => previous,
    joinInitial: initialJoinView('invite-1', 'はなこ'),
  },
} satisfies Meta<typeof InvitePresentation>

export default meta
type Story = StoryObj<typeof meta>

const group = groupOf(
  [
    { user: taro, memberId: 'm1' },
    { user: jiro, memberId: 'm2' },
  ],
  { name: '台湾旅行' },
)

export const 参加する前: Story = {
  args: toInviteView('invite-1', ok({ group, viewer: hanako, alreadyMember: false })),
}

/** 二重に参加しても新しい Member は作られず、表示名も反映されない（`docs/domain/group.md`）。 */
export const すでにメンバー: Story = {
  args: toInviteView('invite-1', ok({ group, viewer: taro, alreadyMember: true })),
}

export const 表示名が空: Story = {
  args: {
    ...toInviteView('invite-1', ok({ group, viewer: hanako, alreadyMember: false })),
    joinInitial: toJoinView(
      { inviteCode: 'invite-1', displayName: '' },
      err({ kind: 'displayNameEmpty' }),
    ),
  },
}

export const 参加コードが見つからない: Story = {
  args: toInviteView('unknown', err({ kind: 'notFound' })),
}

export const 未ログイン: Story = {
  args: toInviteView('invite-1', err({ kind: 'notAuthenticated' })),
}

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toGroupListView } from '@/src/adapter/web/presenter/group'
import { currency, type Currency } from '@/src/domain/money/currency'
import { err, ok } from '@/src/domain/result'
import { groupOf, hanako, jiro, taro } from '@/src/usecase/fixture'
import { GroupListPresentation } from './presentation'

/** グループ一覧（設計 02）。 */
const meta = {
  component: GroupListPresentation,
} satisfies Meta<typeof GroupListPresentation>

export default meta
type Story = StoryObj<typeof meta>

const of = (code: string): Currency => {
  const result = currency(code)
  if (!result.ok) throw new Error('前提の通貨が表に無い')
  return result.value
}

const okinawa = groupOf(
  [
    { user: taro, memberId: 'm1' },
    { user: jiro, memberId: 'm2' },
    { user: hanako, memberId: 'm3' },
  ],
  { id: 'g1', name: '台湾旅行', inviteCode: 'invite-1' },
)

const share = groupOf([{ user: taro, memberId: 'm4' }], {
  id: 'g2',
  name: 'シェアハウス',
  inviteCode: 'invite-2',
})

export const 収支がある: Story = {
  args: toGroupListView(
    ok({
      groups: [
        {
          group: okinawa,
          balances: [
            { currency: of('JPY'), amount: 14_800 },
            { currency: of('TWD'), amount: -295 },
          ],
        },
        { group: share, balances: [{ currency: of('JPY'), amount: -8_400 }] },
      ],
    }),
  ),
}

/** 記録がまだ無いグループは「収支なし」になる。 */
export const 収支がない: Story = {
  args: toGroupListView(ok({ groups: [{ group: share, balances: [] }] })),
}

export const グループがない: Story = {
  args: toGroupListView(ok({ groups: [] })),
}

export const 未ログイン: Story = {
  args: toGroupListView(err({ kind: 'notAuthenticated' })),
}

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toAccountView } from '@/src/adapter/web/presenter/account'
import { err, ok } from '@/src/domain/result'
import { taro } from '@/src/usecase/fixture'
import { AccountPresentation } from './presentation'

/** アカウント（設計 12）。 */
const meta = {
  component: AccountPresentation,
  args: { logOutAction: () => {} },
} satisfies Meta<typeof AccountPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const ログイン済み: Story = { args: toAccountView(ok(taro)) }

export const 未ログイン: Story = { args: toAccountView(err({ kind: 'notAuthenticated' })) }

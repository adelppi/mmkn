import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toLoginView } from '@/src/adapter/web/presenter/account'
import { LoginPresentation } from './presentation'

/** ログイン（設計 01）。 */
const meta = {
  component: LoginPresentation,
  args: { action: () => {} },
} satisfies Meta<typeof LoginPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const ログイン: Story = { args: toLoginView({}) }

export const 招待から: Story = { args: toLoginView({ inviteCode: 'invite-1' }) }

export const 認可画面で断った: Story = { args: toLoginView({ failure: 'loginDenied' }) }

export const ログインに失敗した: Story = { args: toLoginView({ failure: 'loginFailed' }) }

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

export const ログイン: Story = { args: toLoginView() }

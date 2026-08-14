import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toLoginView } from '@/src/adapter/web/presenter/account'
import { LoginPresentation } from './presentation'

/**
 * ログイン（設計 01）。
 *
 * **ログイン手段が増えても画面は変わらない**ことを、分岐として並べて確かめる
 * （`docs/adr/0012-login.md`）。
 */
const meta = {
  component: LoginPresentation,
  args: { action: () => {} },
} satisfies Meta<typeof LoginPresentation>

export default meta
type Story = StoryObj<typeof meta>

/** いま使えるもの（`docs/adr/0012-login.md`）。 */
export const 使えるログイン手段: Story = {
  args: toLoginView(['google', 'discord']),
}

/** 増やしても、画面を作り直さずに並ぶ。 */
export const 増やしたとき: Story = {
  args: toLoginView(['google', 'discord', 'github']),
}

/** ある provider が使えなくなっても、残りで入れる。 */
export const ひとつだけのとき: Story = {
  args: toLoginView(['google']),
}

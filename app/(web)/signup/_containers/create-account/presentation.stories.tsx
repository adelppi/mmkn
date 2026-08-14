import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { err, ok } from '@/src/domain/result'
import { taro } from '@/src/usecase/fixture'
import {
  initialCreateAccountView,
  toCreateAccountView,
} from '@/src/adapter/web/presenter/account'
import { CreateAccountPresentation } from './presentation'

/**
 * アカウント作成（設計 13）。
 *
 * **名前の入力欄は空から始まる**（`docs/domain/group.md`「アカウントを作成する」）。
 */
const meta = {
  component: CreateAccountPresentation,
  args: { action: async (previous) => previous },
} satisfies Meta<typeof CreateAccountPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const 入力前: Story = { args: initialCreateAccountView() }

export const 名前が空: Story = {
  args: toCreateAccountView('  ', err({ kind: 'nameEmpty' })),
}

export const 名前が長すぎる: Story = {
  args: toCreateAccountView('あ'.repeat(24), err({ kind: 'nameTooLong' })),
}

/** 1 つの外部アカウントから 2 つの User はできない（`docs/domain/group.md`）。 */
export const すでに作られている: Story = {
  args: toCreateAccountView('たろう', err({ kind: 'alreadyRegistered' })),
}

export const 本人確認が切れている: Story = {
  args: toCreateAccountView('たろう', err({ kind: 'notAuthenticated' })),
}

export const 作成できた: Story = {
  args: toCreateAccountView('たろう', ok(taro)),
}

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  initialRemoveLoginMethodView,
  toAccountView,
  toRemoveLoginMethodView,
} from '@/src/adapter/web/presenter/account'
import { err, ok } from '@/src/domain/result'
import { taro } from '@/src/usecase/fixture'
import { LoginMethodsPresentation } from './presentation'

/**
 * ログイン手段の管理（設計 12）。
 *
 * **最後の 1 つを削除しようとした失敗も、ここに分岐として並ぶ**
 * （`docs/domain/group.md`「ログイン手段を削除する」）。画面側で判定していないことが、
 * 「削除を押せる状態のまま失敗が返る」形として見える。
 */
const meta = {
  component: LoginMethodsPresentation,
  args: {
    removeAction: async (previous) => previous,
    addAction: () => {},
    logOutAction: () => {},
    removeInitial: initialRemoveLoginMethodView(),
    groupsHref: '/',
  },
} satisfies Meta<typeof LoginMethodsPresentation>

export default meta
type Story = StoryObj<typeof meta>

const account = (services: readonly string[]) =>
  toAccountView(
    ['google', 'discord'],
    ok({ user: taro, loginMethods: services.map((service) => ({ service, id: `${service}-1` })) }),
  )

/** 1 つしかない。**増やすよう促す**（`docs/adr/0012-login.md`「留意点」）。 */
export const ひとつだけ: Story = { args: account(['google']) }

export const ふたつある: Story = { args: account(['google', 'discord']) }

/** **最後の 1 つは削除できない。** 画面は押させ、失敗を受け取って出す。 */
export const 最後のひとつを削除しようとした: Story = {
  args: {
    ...account(['google']),
    removeInitial: toRemoveLoginMethodView('google', err({ kind: 'lastLoginMethod' })),
  },
}

export const 削除できた: Story = {
  args: {
    ...account(['google']),
    removeInitial: toRemoveLoginMethodView('discord', ok(undefined)),
  },
}

export const 未ログイン: Story = {
  args: toAccountView(['google', 'discord'], err({ kind: 'notAuthenticated' })),
}

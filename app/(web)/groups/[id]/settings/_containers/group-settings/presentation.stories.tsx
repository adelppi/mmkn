import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  initialSaveSettingsView,
  toGroupSettingsView,
  toSaveDisplayNameView,
  toSaveSettingsView,
} from '@/src/adapter/web/presenter/group'
import { currency, type Currency } from '@/src/domain/money/currency'
import { err, ok } from '@/src/domain/result'
import { groupOf, hanako, jiro, taro } from '@/src/usecase/fixture'
import { GroupSettingsPresentation } from './presentation'

/**
 * グループ設定・表示名（設計 11）。
 *
 * **参加コードは共有リンクとしてしか出さない**（`docs/domain/group.md`「Group の属性」）。
 */
const meta = {
  component: GroupSettingsPresentation,
  args: {
    settingsAction: async (previous) => previous,
    displayNameAction: async (previous) => previous,
    initial: initialSaveSettingsView(),
  },
} satisfies Meta<typeof GroupSettingsPresentation>

export default meta
type Story = StoryObj<typeof meta>

const group = groupOf(
  [
    { user: taro, memberId: 'm1', displayName: 'あきら' },
    { user: jiro, memberId: 'm2', displayName: 'みなみ' },
    { user: hanako, memberId: 'm3', displayName: 'ゆう' },
  ],
  { name: '台湾旅行', inviteCode: 'k3q9v2tp7bd4x8mzr6cn1jhs' },
)

const viewer = group.members[0]
if (viewer === undefined) throw new Error('前提の Member が無い')

const of = (code: string): Currency => {
  const result = currency(code)
  if (!result.ok) throw new Error('前提の通貨が表に無い')
  return result.value
}

const settings = toGroupSettingsView(
  'https://mmkn.example',
  [of('JPY'), of('TWD')],
  ok({ group, viewer }),
)

export const 設定: Story = { args: settings }

export const 保存できた: Story = {
  args: { ...settings, initial: toSaveSettingsView(ok(group)) },
}

export const 表示名を保存できた: Story = {
  args: { ...settings, initial: toSaveDisplayNameView(ok(group)) },
}

export const グループ名が空: Story = {
  args: { ...settings, initial: toSaveSettingsView(err({ kind: 'groupNameEmpty' })) },
}

export const 表示名が長すぎる: Story = {
  args: { ...settings, initial: toSaveDisplayNameView(err({ kind: 'displayNameTooLong' })) },
}

export const 未ログイン: Story = {
  args: toGroupSettingsView('https://mmkn.example', [], err({ kind: 'notAuthenticated' })),
}

export const 見つからない: Story = {
  args: toGroupSettingsView('https://mmkn.example', [], err({ kind: 'notFound' })),
}

export const メンバーでない: Story = {
  args: toGroupSettingsView('https://mmkn.example', [], err({ kind: 'notMember' })),
}

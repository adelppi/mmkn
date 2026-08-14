import { describe, expect, it, vi } from 'vitest'
import { toGroupId, toMemberId } from '../../../domain/id'
import { err, ok } from '../../../domain/result'
import { groupOf, jiro, taro } from '../../../usecase/fixture'
import {
  initialCreateGroupView,
  initialJoinView,
  initialSaveSettingsView,
} from '../presenter/group'
import { changeDisplayName, changeGroupSettings, createGroup, joinGroup } from './group'

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

const form = (entries: Record<string, string>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(entries)) data.append(name, value)
  return data
}

describe('グループを作成する', () => {
  it('打たれた内容をそのままユースケースに渡す', async () => {
    const usecase = vi.fn(async () => ok(group))

    await createGroup({ createGroup: usecase, actor: taro.id })(
      initialCreateGroupView('JPY'),
      form({ name: '台湾旅行', defaultCurrency: 'TWD' }),
    )

    expect(usecase).toHaveBeenCalledWith({
      actor: taro.id,
      name: '台湾旅行',
      defaultCurrency: 'TWD',
    })
  })

  it('名前の長さも通貨の可否も、ここでは見ない', async () => {
    const usecase = vi.fn(async () => err({ kind: 'currencyUnsupported' as const }))

    const view = await createGroup({ createGroup: usecase, actor: taro.id })(
      initialCreateGroupView('JPY'),
      form({ name: '台湾旅行', defaultCurrency: 'XXX' }),
    )

    expect(usecase).toHaveBeenCalled()
    expect(view.kind).toBe('invalid')
    expect(view.form.defaultCurrency).toBe('XXX')
  })
})

describe('グループに参加する', () => {
  it('参加コードと表示名を渡す', async () => {
    const usecase = vi.fn(async () => ok(group))

    await joinGroup({ joinGroup: usecase, actor: jiro.id })(
      initialJoinView('invite-1', 'じろう'),
      form({ inviteCode: 'invite-1', displayName: 'じろー' }),
    )

    expect(usecase).toHaveBeenCalledWith({
      actor: jiro.id,
      inviteCode: 'invite-1',
      displayName: 'じろー',
    })
  })
})

describe('グループ設定を変更する', () => {
  it('対象の Group と、変える内容を渡す', async () => {
    const usecase = vi.fn(async () => ok(group))

    await changeGroupSettings({ changeGroupSettings: usecase, actor: taro.id })(
      initialSaveSettingsView(),
      form({ groupId: 'g1', name: '沖縄旅行 2026', defaultCurrency: 'JPY' }),
    )

    expect(usecase).toHaveBeenCalledWith({
      actor: taro.id,
      group: toGroupId('g1'),
      name: '沖縄旅行 2026',
      defaultCurrency: 'JPY',
    })
  })
})

describe('表示名を変更する', () => {
  it('変える Member を入力から取る（自分とは限らない）', async () => {
    const usecase = vi.fn(async () => ok(group))

    await changeDisplayName({ changeDisplayName: usecase, actor: taro.id })(
      initialSaveSettingsView(),
      form({ groupId: 'g1', memberId: 'm2', displayName: 'じろー' }),
    )

    expect(usecase).toHaveBeenCalledWith({
      actor: taro.id,
      group: toGroupId('g1'),
      member: toMemberId('m2'),
      displayName: 'じろー',
    })
  })

  it('失敗はビューモデルのタグとして戻る', async () => {
    const view = await changeDisplayName({
      changeDisplayName: async () => err({ kind: 'displayNameEmpty' as const }),
      actor: taro.id,
    })(initialSaveSettingsView(), form({ groupId: 'g1', memberId: 'm1', displayName: '' }))

    expect(view.kind).toBe('invalid')
  })
})

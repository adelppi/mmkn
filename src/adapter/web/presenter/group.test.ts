import { describe, expect, it } from 'vitest'
import { GROUP_NAME_MAX_LENGTH } from '../../../domain/group/text'
import { currency, type Currency } from '../../../domain/money/currency'
import { err, ok } from '../../../domain/result'
import { groupOf, hanako, jiro, taro } from '../../../usecase/fixture'
import {
  initialCreateGroupView,
  toCurrencyOptions,
  toGroupHeaderView,
  toGroupListView,
  toGroupSettingsView,
  toInviteView,
  toJoinView,
  toSaveDisplayNameView,
  toSaveSettingsView,
} from './group'

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

const jpy = (() => {
  const result = currency('JPY')
  if (!result.ok) throw new Error('前提の通貨が表に無い')
  return result.value
})()

describe('入力候補に出す通貨', () => {
  it('通貨コードと名前が並ぶ', () => {
    expect(toCurrencyOptions([]).find((option) => option.code === 'JPY')?.label).toBe(
      'JPY　日本円',
    )
  })
})

describe('グループ一覧', () => {
  const summary = (balances: readonly { currency: Currency; amount: number }[]) =>
    ok({ groups: [{ group, balances }] })

  it('グループ名・人数・自分の収支が並ぶ', () => {
    const view = toGroupListView(summary([{ currency: jpy, amount: 14_800 }]))

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    expect(view.groups[0]?.name).toBe('沖縄旅行')
    expect(view.groups[0]?.memberCount).toBe(2)
    expect(view.groups[0]?.balances[0]?.label).toBe('受け取る')
    expect(view.groups[0]?.balances[0]?.money.digits).toBe('14,800')
    expect(view.groups[0]?.href).toBe('/groups/g1')
  })

  it('収支が負なら「支払う」になる', () => {
    const view = toGroupListView(summary([{ currency: jpy, amount: -8_400 }]))

    expect(view.kind === 'ok' && view.groups[0]?.balances[0]).toMatchObject({
      label: '支払う',
    })
  })

  it('1 つも無ければ空のタグになる', () => {
    const view = toGroupListView(ok({ groups: [] }))

    expect(view.kind).toBe('empty')
  })

  it('ログインしていなければ、その旨が出る', () => {
    const view = toGroupListView(err({ kind: 'notAuthenticated' }))

    expect(view.kind).toBe('notAuthenticated')
  })
})

describe('グループの上端', () => {
  const viewer = group.members[0]
  if (viewer === undefined) throw new Error('前提の Member が無い')

  it('3 つのタブが行き先として並ぶ', () => {
    const view = toGroupHeaderView(ok({ group, viewer }))

    expect(view.kind === 'ok' && view.tabs).toEqual([
      { href: '/groups/g1', label: '記録' },
      { href: '/groups/g1/balances', label: '収支' },
      { href: '/groups/g1/settlement', label: '精算' },
    ])
  })

  /**
   * **どれを選んでいるかは持たない。** 上端は 3 つのタブで共有され、切り替えても
   * 作り直されない（`docs/adr/0009-web-ui.md`「上端を共有する」）。
   */
  it('どのタブを見ているかは、上端の取得に入らない', () => {
    const view = toGroupHeaderView(ok({ group, viewer }))
    const keys = view.kind === 'ok' ? view.tabs.flatMap((tab) => Object.keys(tab)) : []

    expect(keys).not.toContain('current')
  })

  /** 3 区別（`docs/domain/group.md`「前提条件を満たさなかったとき」）。 */
  it('Member でなければ、タブごと出ない', () => {
    const view = toGroupHeaderView(err({ kind: 'notMember' }))

    expect(view.kind).toBe('notMember')
    expect('tabs' in view).toBe(false)
  })
})

describe('グループ作成', () => {
  it('初期状態は既定通貨が入り、上限はドメイン層の定数から来る', () => {
    const view = initialCreateGroupView('JPY')

    expect(view.form.defaultCurrency).toBe('JPY')
    expect(view.form.nameLimits.maxLength).toBe(GROUP_NAME_MAX_LENGTH)
  })

  it('記録が 1 件も無い状態の候補なので、廃止された通貨は現れない', () => {
    expect(initialCreateGroupView('JPY').form.currencies.length).toBeGreaterThan(0)
  })
})

describe('参加コードの下見', () => {
  const output = (alreadyMember: boolean) =>
    ok({ group, viewer: hanako, alreadyMember })

  it('グループ名と Member の表示名が見える', () => {
    const view = toInviteView('invite-1', output(false))

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    expect(view.groupName).toBe('沖縄旅行')
    expect(view.memberNames).toEqual(['たろう', 'じろう'])
  })

  it('表示名の初期値は、その User の名前', () => {
    const view = toInviteView('invite-1', output(false))

    expect(view.kind === 'ok' && view.form.displayName).toBe('はなこ')
  })

  it('既に Member であることが伝わる', () => {
    const view = toInviteView('invite-1', output(true))

    expect(view.kind === 'ok' && view.alreadyMember).toBe(true)
  })

  it('参加コードに対応する Group が無ければ「見つからない」', () => {
    const view = toInviteView('unknown', err({ kind: 'notFound' }))

    expect(view.kind).toBe('notFound')
  })

  it('ログインしていなければ、ログインへの導線が出る', () => {
    const view = toInviteView('invite-1', err({ kind: 'notAuthenticated' }))

    expect(view.kind === 'notAuthenticated' && view.loginHref).toBe('/login')
  })
})

describe('参加の結果', () => {
  it('参加できたら、そのグループへ行く', () => {
    const view = toJoinView({ inviteCode: 'invite-1', displayName: 'はなこ' }, ok(group))

    expect(view.kind === 'joined' && view.redirectTo).toBe('/groups/g1')
  })

  it('表示名が空なら失敗のタグが付く', () => {
    const view = toJoinView(
      { inviteCode: 'invite-1', displayName: '' },
      err({ kind: 'displayNameEmpty' }),
    )

    expect(view.kind === 'invalid' && view.message).toBe('表示名を入力してください。')
  })
})

describe('グループ設定', () => {
  it('設定・自分の表示名・メンバー・共有リンクが並ぶ', () => {
    const view = toGroupSettingsView('https://mmkn.example', [], ok({ group, viewer: group.members[0]! }))

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    expect(view.settings.name).toBe('沖縄旅行')
    expect(view.displayName).toBe('たろう')
    expect(view.members.map((member) => member.isViewer)).toEqual([true, false])
    expect(view.inviteUrl).toBe('https://mmkn.example/j/invite-1')
  })

  it('Member でなければ、中身は返らない', () => {
    const view = toGroupSettingsView('https://mmkn.example', [], err({ kind: 'notMember' }))

    expect(view.kind).toBe('notMember')
    expect(view.kind === 'notMember' && view.message).toContain('メンバーではありません')
  })

  it('存在しない Group は「見つからない」', () => {
    const view = toGroupSettingsView('https://mmkn.example', [], err({ kind: 'notFound' }))

    expect(view.kind).toBe('notFound')
  })
})

describe('設定の保存結果', () => {
  it('保存できたことが伝わる', () => {
    expect(toSaveSettingsView(ok(group))).toEqual({
      kind: 'saved',
      message: 'グループ設定を保存しました。',
    })
  })

  it('表示名の保存も同じ形で伝わる', () => {
    expect(toSaveDisplayNameView(ok(group)).kind).toBe('saved')
  })

  it('グループ名が長すぎれば、失敗のタグが付く', () => {
    const view = toSaveSettingsView(err({ kind: 'groupNameTooLong' }))

    expect(view.kind === 'invalid' && view.message).toContain(String(GROUP_NAME_MAX_LENGTH))
  })
})

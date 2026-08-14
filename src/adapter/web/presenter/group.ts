import type { Group } from '../../../domain/group/group'
import {
  DISPLAY_NAME_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
} from '../../../domain/group/text'
import { selectableCurrencies, type Currency } from '../../../domain/money/currency'
import type { Result } from '../../../domain/result'
import type { ChangeDisplayNameError } from '../../../usecase/group/change-display-name'
import type { ChangeGroupSettingsError } from '../../../usecase/group/change-group-settings'
import type { CreateGroupError } from '../../../usecase/group/create-group'
import type { JoinGroupError } from '../../../usecase/group/join-group'
import type { ListGroupsError, ListGroupsOutput } from '../../../usecase/group/list-groups'
import type { ViewGroupError, ViewGroupOutput } from '../../../usecase/group/view-group'
import type { ViewInviteError, ViewInviteOutput } from '../../../usecase/group/view-invite'
import { currencyNameOf, moneyText, type MoneyText } from '../../shared/money'
import type { TextFieldLimits } from './form'
import { messageOf } from './message'
import { inviteUrl } from '../../shared/invite'
import { route } from './route'

/**
 * グループとメンバーの表示（`docs/features.md` #1〜#4）。
 *
 * **失敗はビューモデルのタグとして表す**（`docs/adr/0009-web-ui.md`「失敗の描画」）。
 * `docs/domain/group.md`「前提条件を満たさなかったとき」の 3 区別が、そのままタグになる。
 */

/** 入力候補に出す通貨（`docs/domain/money.md`「廃止された通貨」）。 */
export type CurrencyOptionView = {
  readonly code: string
  readonly label: string
}

export const toCurrencyOptions = (recorded: readonly Currency[]): readonly CurrencyOptionView[] =>
  selectableCurrencies(recorded).map((code) => ({
    code,
    label: `${code}　${currencyNameOf(code)}`,
  }))

/** 収支を「受け取る／支払う」の 1 行にする（`docs/domain/settlement.md`「収支の意味」）。 */
export type ViewerBalanceRowView = {
  readonly label: string
  readonly money: MoneyText
}

const toViewerBalanceRow = (currency: Currency, amount: number): ViewerBalanceRowView => ({
  label: amount > 0 ? '受け取る' : '支払う',
  money: moneyText(amount, currency, { signed: true }),
})

// ── グループ一覧 ──────────────────────────────────────────────────────────────

export type GroupSummaryView = {
  readonly id: string
  readonly name: string
  readonly memberCount: number
  /** **自分の収支だけ。** 過不足が無い通貨は現れない。 */
  readonly balances: readonly ViewerBalanceRowView[]
  readonly href: string
}

export type GroupListView =
  | {
      readonly kind: 'ok'
      readonly groups: readonly GroupSummaryView[]
      readonly newGroupHref: string
      readonly accountHref: string
    }
  | { readonly kind: 'empty'; readonly newGroupHref: string; readonly accountHref: string }
  | { readonly kind: 'notAuthenticated'; readonly message: string; readonly loginHref: string }

export const toGroupListView = (
  result: Result<ListGroupsOutput, ListGroupsError>,
): GroupListView => {
  if (!result.ok) {
    return { kind: 'notAuthenticated', message: messageOf(result.error), loginHref: route.login() }
  }

  const links = { newGroupHref: route.newGroup(), accountHref: route.account() }

  if (result.value.groups.length === 0) return { kind: 'empty', ...links }

  return {
    kind: 'ok',
    ...links,
    groups: result.value.groups.map((summary) => ({
      id: summary.group.id,
      name: summary.group.name,
      memberCount: summary.group.members.length,
      balances: summary.balances.map((balance) =>
        toViewerBalanceRow(balance.currency, balance.amount),
      ),
      href: route.group(summary.group.id),
    })),
  }
}

// ── グループ作成 ──────────────────────────────────────────────────────────────

export type CreateGroupFields = {
  readonly name: string
  readonly nameLimits: TextFieldLimits
  readonly defaultCurrency: string
  readonly currencies: readonly CurrencyOptionView[]
}

export type CreateGroupView =
  | { readonly kind: 'input'; readonly form: CreateGroupFields }
  | { readonly kind: 'invalid'; readonly form: CreateGroupFields; readonly message: string }
  | { readonly kind: 'created'; readonly form: CreateGroupFields; readonly redirectTo: string }

const createGroupFields = (name: string, defaultCurrency: string): CreateGroupFields => ({
  name,
  nameLimits: { maxLength: GROUP_NAME_MAX_LENGTH, required: true },
  defaultCurrency,
  // **記録が 1 件も無い状態**なので、廃止された通貨は候補に現れない（`docs/domain/money.md`）。
  currencies: toCurrencyOptions([]),
})

export const initialCreateGroupView = (defaultCurrency: string): CreateGroupView => ({
  kind: 'input',
  form: createGroupFields('', defaultCurrency),
})

export const toCreateGroupView = (
  input: { readonly name: string; readonly defaultCurrency: string },
  result: Result<Group, CreateGroupError>,
): CreateGroupView =>
  result.ok
    ? {
        kind: 'created',
        form: createGroupFields(result.value.name, result.value.defaultCurrency),
        redirectTo: route.group(result.value.id),
      }
    : {
        kind: 'invalid',
        form: createGroupFields(input.name, input.defaultCurrency),
        message: messageOf(result.error),
      }

// ── 参加（`docs/domain/group.md`「グループに参加する」）───────────────────────

export type JoinFields = {
  readonly inviteCode: string
  readonly displayName: string
  readonly displayNameLimits: TextFieldLimits
}

export type InviteView =
  | {
      readonly kind: 'ok'
      readonly groupName: string
      /** **記録・収支・清算案の中身は含まない。** 参加する前に見えるのは、ここまで。 */
      readonly memberNames: readonly string[]
      readonly alreadyMember: boolean
      readonly form: JoinFields
    }
  | { readonly kind: 'notFound'; readonly message: string; readonly groupsHref: string }
  | { readonly kind: 'notAuthenticated'; readonly message: string; readonly loginHref: string }

export const toInviteView = (
  inviteCode: string,
  result: Result<ViewInviteOutput, ViewInviteError>,
): InviteView => {
  if (!result.ok) {
    return result.error.kind === 'notAuthenticated'
      ? { kind: 'notAuthenticated', message: messageOf(result.error), loginHref: route.login() }
      : { kind: 'notFound', message: messageOf(result.error), groupsHref: route.groups() }
  }

  return {
    kind: 'ok',
    groupName: result.value.group.name,
    memberNames: result.value.group.members.map((member) => member.displayName),
    alreadyMember: result.value.alreadyMember,
    form: {
      inviteCode,
      // 表示名の初期値には、その User の名前を使う（作成者の初期値と同じ形）。
      displayName: result.value.viewer.name,
      displayNameLimits: { maxLength: DISPLAY_NAME_MAX_LENGTH, required: true },
    },
  }
}

export type JoinView =
  | { readonly kind: 'input'; readonly form: JoinFields }
  | { readonly kind: 'invalid'; readonly form: JoinFields; readonly message: string }
  | { readonly kind: 'joined'; readonly form: JoinFields; readonly redirectTo: string }

const joinFields = (inviteCode: string, displayName: string): JoinFields => ({
  inviteCode,
  displayName,
  displayNameLimits: { maxLength: DISPLAY_NAME_MAX_LENGTH, required: true },
})

export const initialJoinView = (inviteCode: string, displayName: string): JoinView => ({
  kind: 'input',
  form: joinFields(inviteCode, displayName),
})

export const toJoinView = (
  input: { readonly inviteCode: string; readonly displayName: string },
  result: Result<Group, JoinGroupError>,
): JoinView =>
  result.ok
    ? {
        kind: 'joined',
        form: joinFields(input.inviteCode, input.displayName),
        redirectTo: route.group(result.value.id),
      }
    : {
        kind: 'invalid',
        form: joinFields(input.inviteCode, input.displayName),
        message: messageOf(result.error),
      }

// ── グループの上端（設計 03〜05 に共通）────────────────────────────────────────

/** 記録・収支・精算の切り替え。**切り替えは画面の移動である。** */
export type GroupTab = 'records' | 'balances' | 'settlement'

/**
 * タブ 1 つ分。
 *
 * **どれを見ているかは持たない**（`docs/adr/0009-web-ui.md`「上端を共有する」）。
 * 上端は 3 つのタブで共有され、切り替えのたびに作り直されない。作り直されないものは
 * 「いまどこにいるか」を知り得ないため、選択状態は場所を見ている側（`app/_ui/tab-bar.tsx`）が決める。
 */
export type GroupTabView = {
  readonly href: string
  readonly label: string
}

export type GroupHeaderView =
  | {
      readonly kind: 'ok'
      readonly name: string
      readonly groupsHref: string
      readonly settingsHref: string
      readonly newRecordHref: string
      readonly tabs: readonly GroupTabView[]
    }
  | {
      readonly kind: 'notAuthenticated' | 'notFound' | 'notMember'
      readonly message: string
      readonly groupsHref: string
    }

const TAB_LABELS: readonly { readonly tab: GroupTab; readonly label: string }[] = [
  { tab: 'records', label: '記録' },
  { tab: 'balances', label: '収支' },
  { tab: 'settlement', label: '精算' },
]

const tabHref = (tab: GroupTab, groupId: string): string =>
  tab === 'records'
    ? route.group(groupId)
    : tab === 'balances'
      ? route.balances(groupId)
      : route.settlement(groupId)

export const toGroupHeaderView = (
  result: Result<ViewGroupOutput, ViewGroupError>,
): GroupHeaderView => {
  if (!result.ok) {
    return { kind: result.error.kind, message: messageOf(result.error), groupsHref: route.groups() }
  }

  const groupId = result.value.group.id

  return {
    kind: 'ok',
    name: result.value.group.name,
    groupsHref: route.groups(),
    settingsHref: route.settings(groupId),
    newRecordHref: route.newRecord(groupId),
    tabs: TAB_LABELS.map(({ tab, label }) => ({ href: tabHref(tab, groupId), label })),
  }
}

// ── グループ設定（`docs/domain/group.md`「グループ設定を変更する」「表示名を変更する」）──

export type MemberView = {
  readonly id: string
  readonly displayName: string
  readonly isViewer: boolean
}

export type GroupSettingsView =
  | {
      readonly kind: 'ok'
      readonly groupId: string
      readonly groupHref: string
      readonly settings: CreateGroupFields
      readonly viewerMemberId: string
      readonly displayName: string
      readonly displayNameLimits: TextFieldLimits
      readonly members: readonly MemberView[]
      /** 共有リンク。**参加コードそのものは、この形でしか渡らない。** */
      readonly inviteUrl: string
    }
  | {
      readonly kind: 'notAuthenticated' | 'notFound' | 'notMember'
      readonly message: string
      readonly groupsHref: string
    }

export const toGroupSettingsView = (
  origin: string,
  recorded: readonly Currency[],
  result: Result<ViewGroupOutput, ViewGroupError>,
): GroupSettingsView => {
  if (!result.ok) {
    return { kind: result.error.kind, message: messageOf(result.error), groupsHref: route.groups() }
  }

  const { group, viewer } = result.value

  return {
    kind: 'ok',
    groupId: group.id,
    groupHref: route.group(group.id),
    settings: {
      name: group.name,
      nameLimits: { maxLength: GROUP_NAME_MAX_LENGTH, required: true },
      defaultCurrency: group.defaultCurrency,
      // **そのグループに記録がある通貨は、廃止済みでも候補に残る**（`docs/domain/money.md`）。
      currencies: toCurrencyOptions(recorded),
    },
    viewerMemberId: viewer.id,
    displayName: viewer.displayName,
    displayNameLimits: { maxLength: DISPLAY_NAME_MAX_LENGTH, required: true },
    members: group.members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      isViewer: member.id === viewer.id,
    })),
    inviteUrl: inviteUrl(origin, group.inviteCode),
  }
}

/** 設定の保存結果。**後勝ちで置き換わるため、競合の失敗はここに現れない**（`docs/domain/group.md`）。 */
export type SaveSettingsView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saved'; readonly message: string }
  | { readonly kind: 'invalid'; readonly message: string }

export const initialSaveSettingsView = (): SaveSettingsView => ({ kind: 'idle' })

export const toSaveSettingsView = (
  result: Result<Group, ChangeGroupSettingsError>,
): SaveSettingsView =>
  result.ok
    ? { kind: 'saved', message: 'グループ設定を保存しました。' }
    : { kind: 'invalid', message: messageOf(result.error) }

export const toSaveDisplayNameView = (
  result: Result<Group, ChangeDisplayNameError>,
): SaveSettingsView =>
  result.ok
    ? { kind: 'saved', message: '表示名を保存しました。' }
    : { kind: 'invalid', message: messageOf(result.error) }

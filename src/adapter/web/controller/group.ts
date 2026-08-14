import type { Group } from '../../../domain/group/group'
import { toGroupId, toMemberId, type UserId } from '../../../domain/id'
import type {
  ChangeDisplayNameError,
  ChangeDisplayNameInput,
} from '../../../usecase/group/change-display-name'
import type {
  ChangeGroupSettingsError,
  ChangeGroupSettingsInput,
} from '../../../usecase/group/change-group-settings'
import type { CreateGroupError, CreateGroupInput } from '../../../usecase/group/create-group'
import type { JoinGroupError, JoinGroupInput } from '../../../usecase/group/join-group'
import type { UseCase } from '../../../usecase/usecase'
import { field } from '../presenter/form'
import {
  toCreateGroupView,
  toJoinView,
  toSaveDisplayNameView,
  toSaveSettingsView,
  type CreateGroupView,
  type JoinView,
  type SaveSettingsView,
} from '../presenter/group'

/**
 * グループとメンバーへの操作（`docs/features.md` #1〜#4）。
 *
 * **入力の変換だけを行う。** 名前の長さも通貨の可否も見ない。判定はドメイン層にあり、
 * 失敗はビューモデルのタグとして戻る（`docs/adr/0009-web-ui.md`）。
 */

export const createGroup =
  (deps: {
    createGroup: UseCase<CreateGroupInput, Group, CreateGroupError>
    actor: UserId | undefined
  }) =>
  async (_previous: CreateGroupView, data: FormData): Promise<CreateGroupView> => {
    const input = { name: field(data, 'name'), defaultCurrency: field(data, 'defaultCurrency') }

    return toCreateGroupView(input, await deps.createGroup({ actor: deps.actor, ...input }))
  }

export const joinGroup =
  (deps: {
    joinGroup: UseCase<JoinGroupInput, Group, JoinGroupError>
    actor: UserId | undefined
  }) =>
  async (_previous: JoinView, data: FormData): Promise<JoinView> => {
    const input = {
      inviteCode: field(data, 'inviteCode'),
      displayName: field(data, 'displayName'),
    }

    return toJoinView(input, await deps.joinGroup({ actor: deps.actor, ...input }))
  }

export const changeGroupSettings =
  (deps: {
    changeGroupSettings: UseCase<ChangeGroupSettingsInput, Group, ChangeGroupSettingsError>
    actor: UserId | undefined
  }) =>
  async (_previous: SaveSettingsView, data: FormData): Promise<SaveSettingsView> =>
    toSaveSettingsView(
      await deps.changeGroupSettings({
        actor: deps.actor,
        group: toGroupId(field(data, 'groupId')),
        name: field(data, 'name'),
        defaultCurrency: field(data, 'defaultCurrency'),
      }),
    )

/** **変えるのは自分の分とは限らない**（`docs/domain/group.md`「表示名を変更する」）。 */
export const changeDisplayName =
  (deps: {
    changeDisplayName: UseCase<ChangeDisplayNameInput, Group, ChangeDisplayNameError>
    actor: UserId | undefined
  }) =>
  async (_previous: SaveSettingsView, data: FormData): Promise<SaveSettingsView> =>
    toSaveDisplayNameView(
      await deps.changeDisplayName({
        actor: deps.actor,
        group: toGroupId(field(data, 'groupId')),
        member: toMemberId(field(data, 'memberId')),
        displayName: field(data, 'displayName'),
      }),
    )

import type { GroupAccessDenied } from '../../domain/group/access'
import { Group, type ChangeSettingsFailure } from '../../domain/group/group'
import type { GroupId, UserId } from '../../domain/id'
import { ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { UseCase } from '../usecase'
import { loadGroupAsMember } from './access'

/**
 * グループ設定を変更する（`docs/domain/group.md`「グループ設定を変更する」・`docs/features.md` #4）。
 *
 * **過去の記録は一切変わらない。** 既定通貨は入力の初期値でしかないため、
 * 既に記録された Payment / Transfer の通貨は書き換わらない。
 */

export type ChangeGroupSettingsInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  /** 変えるものだけを渡す。渡さなかった属性は変わらない。 */
  readonly name?: string
  readonly defaultCurrency?: string
}

export type ChangeGroupSettingsError = GroupAccessDenied | ChangeSettingsFailure

export const changeGroupSettings =
  (deps: {
    groups: GroupRepository
  }): UseCase<ChangeGroupSettingsInput, Group, ChangeGroupSettingsError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const changed = Group.changeSettings(loaded.value.group, {
      actor: input.actor,
      name: input.name,
      defaultCurrency: input.defaultCurrency,
    })
    if (!changed.ok) return changed

    // **同時に変更されても失敗させない。後から届いた方が勝つ**（`docs/domain/group.md`）。
    // 版を持たないのはこのため（`docs/adr/0005-data-access-and-authorization.md`）。
    await deps.groups.saveSettings(changed.value)

    return ok(changed.value)
  }

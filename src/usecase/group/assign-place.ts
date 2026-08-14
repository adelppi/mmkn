import type { GroupAccessDenied } from '../../domain/group/access'
import { PlaceMapping, type Place } from '../../domain/group/place-mapping'
import type { GroupId, UserId } from '../../domain/id'
import { ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { PlaceMappingRepository } from '../port/place-mapping-repository'
import type { UseCase } from '../usecase'
import { loadGroupAsMember } from './access'

/**
 * 場に Group を対応づける（`docs/domain/group.md`「場に Group を対応づける」・`docs/features.md` #13）。
 *
 * **対応づけは参加ではない。** その場にいる人が Member になることはない。
 */

export type AssignPlaceInput = {
  readonly actor: UserId | undefined
  readonly place: Place
  readonly group: GroupId
}

/**
 * 失敗。対象の Group を読むところから確かめるため、3 区別すべてが起こり得る
 * （`PlaceMapping.assign` が返す `MemberAccessDenied` はこの一部）。
 */
export type AssignPlaceError = GroupAccessDenied

export const assignPlace =
  (deps: {
    groups: GroupRepository
    placeMappings: PlaceMappingRepository
  }): UseCase<AssignPlaceInput, PlaceMapping, AssignPlaceError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    // 場を鍵として持つため、判定に要るのはその場の現在の対応だけ。
    const current = await deps.placeMappings.find(input.place)

    const assigned = PlaceMapping.assign({
      mappings: current === undefined ? [] : [current],
      place: input.place,
      group: loaded.value.group,
      actor: input.actor,
    })
    if (!assigned.ok) return assigned

    const mapping: PlaceMapping = { place: input.place, groupId: loaded.value.group.id }

    // **その場に既に別の Group が対応していた場合は置き換える。** 同時に届いても失敗させない
    // （`docs/domain/group.md`「境界・例外ケース」：後から届いた方が勝つ）。
    await deps.placeMappings.save(mapping)

    return ok(mapping)
  }

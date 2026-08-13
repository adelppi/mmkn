import type { GroupAccessDenied } from '../../domain/group/access'
import { PlaceMapping, type Place } from '../../domain/group/place-mapping'
import type { UserId } from '../../domain/id'
import { ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { PlaceMappingRepository } from '../port/place-mapping-repository'
import type { UseCase } from '../usecase'

/**
 * 場と Group の対応を解除する（`docs/domain/group.md`「場と Group の対応を解除する」・
 * `docs/features.md` #13）。
 *
 * 前提条件は「操作する User が、**その場に対応する Group** の Member であること」。
 * 対象の Group は入力に取らず、場から解決する。
 *
 * **Group 自体は消えない。** 他の場からも、場を使わないクライアントからも引き続き操作できる。
 */

export type ReleasePlaceInput = {
  readonly actor: UserId | undefined
  readonly place: Place
}

export type ReleasePlaceError = GroupAccessDenied

export const releasePlace =
  (deps: {
    groups: GroupRepository
    placeMappings: PlaceMappingRepository
  }): UseCase<ReleasePlaceInput, void, ReleasePlaceError> =>
  async (input) => {
    const current = await deps.placeMappings.find(input.place)
    const group = current === undefined ? undefined : await deps.groups.findById(current.groupId)

    // 対応が無い場合と、対応先の Group が読めない場合は「見つからない」になる。判定はドメインが行う。
    const released = PlaceMapping.release({
      mappings: current === undefined ? [] : [current],
      place: input.place,
      group,
      actor: input.actor,
    })
    if (!released.ok) return released

    await deps.placeMappings.remove(input.place)

    return ok(undefined)
  }

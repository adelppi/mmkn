import type { PlaceMapping } from '../../../domain/group/place-mapping'
import { toGroupId } from '../../../domain/id'

/**
 * `place_mappings` の行と `PlaceMapping` の変換。
 *
 * **行の形をここで明示的に宣言する**（理由は `mapper/user.ts` と同じ）。
 */

export type PlaceMappingRow = {
  readonly service: string
  readonly placeId: string
  readonly groupId: string
}

export const toPlaceMapping = (row: PlaceMappingRow): PlaceMapping => ({
  place: { service: row.service, id: row.placeId },
  groupId: toGroupId(row.groupId),
})

export const fromPlaceMapping = (mapping: PlaceMapping): PlaceMappingRow => ({
  service: mapping.place.service,
  placeId: mapping.place.id,
  groupId: mapping.groupId,
})

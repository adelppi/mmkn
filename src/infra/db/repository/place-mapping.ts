import { and, eq } from 'drizzle-orm'
import type { Place, PlaceMapping } from '../../../domain/group/place-mapping'
import type { PlaceMappingRepository } from '../../../usecase/port/place-mapping-repository'
import type { Database } from '../client'
import { fromPlaceMapping, toPlaceMapping } from '../mapper/place-mapping'
import { placeMappings } from '../schema'

/** `PlaceMappingRepository` の実装。 */
export const drizzlePlaceMappingRepository = (db: Database): PlaceMappingRepository => {
  const at = (place: Place) =>
    and(eq(placeMappings.service, place.service), eq(placeMappings.placeId, place.id))

  return {
    async find(place: Place) {
      const [row] = await db.select().from(placeMappings).where(at(place)).limit(1)
      return row === undefined ? undefined : toPlaceMapping(row)
    },

    async save(mapping: PlaceMapping) {
      // **その場に既に別の Group が対応していた場合は置き換える**（後勝ち。`docs/domain/group.md`）。
      // 2 人が同時に対応づけても失敗させない。
      const row = fromPlaceMapping(mapping)
      await db
        .insert(placeMappings)
        .values(row)
        .onConflictDoUpdate({
          target: [placeMappings.service, placeMappings.placeId],
          set: { groupId: row.groupId },
        })
    },

    async remove(place: Place) {
      // **Group 自体は消えない。** 消えるのは場との対応だけ。
      await db.delete(placeMappings).where(at(place))
    },
  }
}

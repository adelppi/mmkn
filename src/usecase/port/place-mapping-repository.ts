import type { Place, PlaceMapping } from '../../domain/group/place-mapping'

/**
 * 場と Group の対応の永続化ポート
 * （`docs/adr/0008-layer-internals.md` のツリー：(サービス種別, 場の識別子) → Group）。
 *
 * **1 つの場に対応する Group は 1 つ**であるため、場を鍵として扱う
 * （`docs/domain/group.md`「Group と外部サービスの場」）。1 つの Group が複数の場に対応することは、
 * 鍵の違う行が複数あることとして表れる。
 */
export type PlaceMappingRepository = {
  /** その場に対応する Group を読む。対応づけられていなければ `undefined`。 */
  find(place: Place): Promise<PlaceMapping | undefined>

  /**
   * 場と Group の対応を書き込む。
   *
   * **その場に既に別の Group が対応していた場合は置き換える**（後勝ち。`docs/domain/group.md`）。
   * 同時に対応づけられても失敗させない。
   */
  save(mapping: PlaceMapping): Promise<void>

  /** その場の対応を消す。**Group 自体は消えない。** */
  remove(place: Place): Promise<void>
}

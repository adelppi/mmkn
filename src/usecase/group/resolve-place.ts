import type { Place } from '../../domain/group/place-mapping'
import type { GroupId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { PlaceMappingRepository } from '../port/place-mapping-repository'
import type { UseCase } from '../usecase'

/**
 * 場から、操作の対象になる Group を解決する
 * （`docs/domain/group.md`「Group と外部サービスの場」）。
 *
 * **1 つの場に対応する Group は 1 つ**であり、対象は常に一意に決まる。
 * 対応づけられていなければ失敗し、**対象の Group が自動的に選ばれることはない**
 * （`docs/domain/group.md`「対応づけられていない場から操作したとき」）。
 *
 * **返すのは識別子だけである。** Group の中身（名前・Member・参加コード）を返すと、
 * その場にいるだけで Member でない人にグループの中身が渡る経路ができる。
 * 中身を読むのは、Member であることを確かめる別のユースケースの責務
 * （`docs/domain/group.md`「前提条件を満たさなかったとき」）。
 *
 * **場と参加は無関係である。** ここで解決できることは Member であることを意味しない。
 */

export type ResolvePlaceInput = {
  readonly place: Place
}

export type ResolvePlaceOutput = {
  readonly group: GroupId
}

/** その場に Group が対応づけられていない。 */
export type ResolvePlaceError = { readonly kind: 'placeNotAssigned' }

export const resolvePlace =
  (deps: {
    placeMappings: PlaceMappingRepository
  }): UseCase<ResolvePlaceInput, ResolvePlaceOutput, ResolvePlaceError> =>
  async (input) => {
    const mapping = await deps.placeMappings.find(input.place)
    if (mapping === undefined) return err({ kind: 'placeNotAssigned' })

    return ok({ group: mapping.groupId })
  }

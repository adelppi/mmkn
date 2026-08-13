import { idEquals, type GroupId, type UserId } from '../id'
import { ok, type Result } from '../result'
import {
  requireGroupMember,
  requireMember,
  type GroupAccessDenied,
  type MemberAccessDenied,
} from './access'
import type { Group } from './group'

/**
 * 外部サービス上で、人が集まって会話する単位（`docs/domain/group.md`「Group と外部サービスの場」）。
 *
 * どのサービスに、どんな場があるかはドメインの関心ではないため、種別の値を列挙しない
 * （`docs/adr/0004-layers-and-dependencies.md`：クライアント固有のものを内側に持ち込まない）。
 */
export type Place = {
  readonly service: string
  readonly id: string
}

/**
 * 場と Group の対応。
 *
 * **参加とは無関係。** その場にいることは Member であることを意味しないし、
 * 対応づけによって Member が増えることもない。
 */
export type PlaceMapping = {
  readonly place: Place
  readonly groupId: GroupId
}

const samePlace = (a: Place, b: Place): boolean => a.service === b.service && a.id === b.id

/**
 * 場に対応する Group を解決する。**1 つの場に対応する Group は 1 つ**であり、常に一意に決まる。
 * 対応づけられていなければ `undefined`。
 */
const resolve = (mappings: readonly PlaceMapping[], place: Place): GroupId | undefined =>
  mappings.find((mapping) => samePlace(mapping.place, place))?.groupId

/**
 * 場に Group を対応づける（`docs/domain/group.md`「場に Group を対応づける」）。
 *
 * その場に既に別の Group が対応していた場合、**新しい対応で置き換える**。
 * 同時に対応づけられても失敗させない（後から届いた方が勝つ）。
 * その Group に既に対応している他の場の対応は変わらない。
 */
const assign = (input: {
  mappings: readonly PlaceMapping[]
  place: Place
  group: Group
  actor: UserId | undefined
}): Result<readonly PlaceMapping[], MemberAccessDenied> => {
  const member = requireMember(input.group, input.actor)
  if (!member.ok) return member

  const others = input.mappings.filter((mapping) => !samePlace(mapping.place, input.place))

  return ok([...others, { place: input.place, groupId: input.group.id }])
}

/**
 * 場と Group の対応を解除する（`docs/domain/group.md`「場と Group の対応を解除する」）。
 *
 * 前提条件は「操作する User が、その場に対応する Group の Member であること」。
 * `group` には、その場に対応する Group（`resolve` で解決したもの）を渡す。
 * 対応が無い場合と、渡された Group がその場の対応先でない場合は「存在しない」失敗になる。
 *
 * Group 自体は消えない。他の場からも、場を使わないクライアントからも、引き続き操作できる。
 */
const release = (input: {
  mappings: readonly PlaceMapping[]
  place: Place
  group: Group | undefined
  actor: UserId | undefined
}): Result<readonly PlaceMapping[], GroupAccessDenied> => {
  const mapped = resolve(input.mappings, input.place)
  const target =
    input.group !== undefined && mapped !== undefined && idEquals(input.group.id, mapped)
      ? input.group
      : undefined

  const member = requireGroupMember(target, input.actor)
  if (!member.ok) return member

  return ok(input.mappings.filter((mapping) => !samePlace(mapping.place, input.place)))
}

/**
 * 場と Group の対応への操作と参照。
 *
 * **1 つの Group は複数の場に対応してよい**ため、対応は場を鍵とした集まりとして扱う。
 */
export const PlaceMapping = { resolve, assign, release, samePlace }

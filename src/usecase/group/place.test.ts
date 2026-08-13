import { describe, expect, it } from 'vitest'
import type { Place } from '../../domain/group/place-mapping'
import { toGroupId } from '../../domain/id'
import { groupOf, hanako, jiro, taro } from '../fixture'
import { fakeGroupRepository, fakePlaceMappingRepository } from '../port/fake'
import { assignPlace } from './assign-place'
import { releasePlace } from './release-place'

/**
 * 場と Group の対応づけ・解除（`docs/features.md` #13）。
 *
 * 対応づけと解除は同じ表に対する裏表の操作であるため、1 つのファイルにまとめてある。
 */

const okinawa: Place = { service: 'discord', id: 'channel-1' }
const hokkaido: Place = { service: 'discord', id: 'channel-2' }

const deps = (mappings: readonly { place: Place; groupId: string }[] = []) => ({
  groups: fakeGroupRepository([
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
    groupOf([{ user: jiro, memberId: 'm3' }], { id: 'g2', inviteCode: 'invite-2' }),
  ]),
  placeMappings: fakePlaceMappingRepository(
    mappings.map((mapping) => ({ place: mapping.place, groupId: toGroupId(mapping.groupId) })),
  ),
})

describe('場に Group を対応づける', () => {
  it('対応が記録される', async () => {
    const d = deps()

    const result = await assignPlace(d)({
      actor: taro.id,
      place: okinawa,
      group: toGroupId('g1'),
    })

    expect(result.ok).toBe(true)
    expect(d.placeMappings.stored()).toEqual([{ place: okinawa, groupId: toGroupId('g1') }])
  })

  it('その場に既に別の Group が対応していたら、新しい対応で置き換える', async () => {
    const d = deps([{ place: okinawa, groupId: 'g2' }])

    await assignPlace(d)({ actor: taro.id, place: okinawa, group: toGroupId('g1') })

    expect(d.placeMappings.stored()).toEqual([{ place: okinawa, groupId: toGroupId('g1') }])
  })

  it('その Group に既に対応している他の場の対応は変わらない', async () => {
    const d = deps([{ place: hokkaido, groupId: 'g1' }])

    await assignPlace(d)({ actor: taro.id, place: okinawa, group: toGroupId('g1') })

    expect(d.placeMappings.stored()).toHaveLength(2)
  })

  it('Member は増えない', async () => {
    const d = deps()

    await assignPlace(d)({ actor: taro.id, place: okinawa, group: toGroupId('g1') })

    const group = d.groups.stored().find((it) => it.id === toGroupId('g1'))
    expect(group?.members).toHaveLength(2)
  })

  it('その Group の Member でなければ失敗し、対応は記録されない', async () => {
    const d = deps()

    const result = await assignPlace(d)({
      actor: hanako.id,
      place: okinawa,
      group: toGroupId('g1'),
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
    expect(d.placeMappings.stored()).toHaveLength(0)
  })

  it('Group が存在しなければ、見つからないとして伝える', async () => {
    const d = deps()

    const result = await assignPlace(d)({
      actor: taro.id,
      place: okinawa,
      group: toGroupId('いない'),
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notFound' } })
  })
})

describe('場と Group の対応を解除する', () => {
  it('対応が消える', async () => {
    const d = deps([{ place: okinawa, groupId: 'g1' }])

    const result = await releasePlace(d)({ actor: taro.id, place: okinawa })

    expect(result.ok).toBe(true)
    expect(d.placeMappings.stored()).toHaveLength(0)
  })

  it('Group 自体は消えない', async () => {
    const d = deps([{ place: okinawa, groupId: 'g1' }])

    await releasePlace(d)({ actor: taro.id, place: okinawa })

    expect(d.groups.stored()).toHaveLength(2)
  })

  it('その場に対応する Group の Member でなければ失敗し、対応は残る', async () => {
    const d = deps([{ place: okinawa, groupId: 'g1' }])

    const result = await releasePlace(d)({ actor: hanako.id, place: okinawa })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
    expect(d.placeMappings.stored()).toHaveLength(1)
  })

  it('対応づけられていない場なら、見つからないとして失敗する', async () => {
    const d = deps()

    const result = await releasePlace(d)({ actor: taro.id, place: okinawa })

    expect(result).toEqual({ ok: false, error: { kind: 'notFound' } })
  })

  it('ログインしていなければ、対象の有無に依らず未ログインとして伝える', async () => {
    const d = deps()

    const result = await releasePlace(d)({ actor: undefined, place: okinawa })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
  })

  it('他の場の対応は変わらない', async () => {
    const d = deps([
      { place: okinawa, groupId: 'g1' },
      { place: hokkaido, groupId: 'g1' },
    ])

    await releasePlace(d)({ actor: taro.id, place: okinawa })

    expect(d.placeMappings.stored()).toEqual([{ place: hokkaido, groupId: toGroupId('g1') }])
  })
})

import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId, toUserId } from '../id'
import { Group } from './group'
import { PlaceMapping, type Place } from './place-mapping'
import { User } from './user'

const userOf = (id: string, name: string) => {
  const user = User.create({ id: toUserId(id), name, loginIdentifier: `auth-${id}` })
  if (!user.ok) throw new Error('前提の User を作れなかった')
  return user.value
}

const taro = userOf('u1', 'たろう')
const jiro = userOf('u2', 'じろう')

const groupOf = (id: string, memberId: string) => {
  const group = Group.create({
    id: toGroupId(id),
    name: '沖縄旅行',
    defaultCurrency: 'JPY',
    inviteCode: `invite-${id}`,
    creator: taro,
    creatorMemberId: toMemberId(memberId),
  })
  if (!group.ok) throw new Error('前提の Group を作れなかった')
  return group.value
}

const okinawa = groupOf('g1', 'm1')
const hokkaido = groupOf('g2', 'm2')

const channelA: Place = { service: 'discord', id: 'c1' }
const channelB: Place = { service: 'discord', id: 'c2' }

const assigned = (...args: Parameters<typeof PlaceMapping.assign>) => {
  const mappings = PlaceMapping.assign(...args)
  if (!mappings.ok) throw new Error('前提の対応づけに失敗した')
  return mappings.value
}

describe('場と Group の対応', () => {
  describe('対応づける', () => {
    it('Member なら対応づけられる', () => {
      const mappings = assigned({ mappings: [], place: channelA, group: okinawa, actor: taro.id })

      expect(PlaceMapping.resolve(mappings, channelA)).toBe(okinawa.id)
    })

    it('Member でなければ失敗する', () => {
      expect(
        PlaceMapping.assign({ mappings: [], place: channelA, group: okinawa, actor: jiro.id }),
      ).toEqual({ ok: false, error: { kind: 'notMember' } })
    })

    it('ログインしていなければ失敗する', () => {
      expect(
        PlaceMapping.assign({ mappings: [], place: channelA, group: okinawa, actor: undefined }),
      ).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    })

    it('1 つの場に対応する Group は 1 つ。後から届いた対応で置き換わる', () => {
      const first = assigned({ mappings: [], place: channelA, group: okinawa, actor: taro.id })
      const second = assigned({
        mappings: first,
        place: channelA,
        group: hokkaido,
        actor: taro.id,
      })

      expect(second).toHaveLength(1)
      expect(PlaceMapping.resolve(second, channelA)).toBe(hokkaido.id)
    })

    it('1 つの Group は複数の場に対応してよい', () => {
      const first = assigned({ mappings: [], place: channelA, group: okinawa, actor: taro.id })
      const second = assigned({ mappings: first, place: channelB, group: okinawa, actor: taro.id })

      expect(PlaceMapping.resolve(second, channelA)).toBe(okinawa.id)
      expect(PlaceMapping.resolve(second, channelB)).toBe(okinawa.id)
    })

    it('その Group に既に対応している他の場の対応は変わらない', () => {
      const before = assigned({ mappings: [], place: channelB, group: okinawa, actor: taro.id })
      const after = assigned({
        mappings: before,
        place: channelA,
        group: hokkaido,
        actor: taro.id,
      })

      expect(PlaceMapping.resolve(after, channelB)).toBe(okinawa.id)
    })

    it('対応づけても Member は増えない', () => {
      assigned({ mappings: [], place: channelA, group: okinawa, actor: taro.id })

      expect(okinawa.members).toHaveLength(1)
    })

    it('サービスが違えば別の場として扱う', () => {
      const mappings = assigned({ mappings: [], place: channelA, group: okinawa, actor: taro.id })

      expect(PlaceMapping.resolve(mappings, { service: 'other', id: channelA.id })).toBeUndefined()
    })
  })

  describe('解決する', () => {
    it('対応づけられていない場では、Group が決まらない', () => {
      expect(PlaceMapping.resolve([], channelA)).toBeUndefined()
    })

    it('どの場にも対応づけられていない Group が存在してよい', () => {
      const mappings = assigned({ mappings: [], place: channelA, group: okinawa, actor: taro.id })

      expect(mappings.some((mapping) => mapping.groupId === hokkaido.id)).toBe(false)
    })
  })

  describe('解除する', () => {
    const mapped = assigned({ mappings: [], place: channelA, group: okinawa, actor: taro.id })

    it('その Group の Member なら解除できる', () => {
      const released = PlaceMapping.release({
        mappings: mapped,
        place: channelA,
        group: okinawa,
        actor: taro.id,
      })

      expect(released.ok && PlaceMapping.resolve(released.value, channelA)).toBeUndefined()
    })

    it('Member でなければ失敗する', () => {
      expect(
        PlaceMapping.release({
          mappings: mapped,
          place: channelA,
          group: okinawa,
          actor: jiro.id,
        }),
      ).toEqual({ ok: false, error: { kind: 'notMember' } })
    })

    it('対応が無ければ、見つからないことを返す', () => {
      expect(
        PlaceMapping.release({
          mappings: mapped,
          place: channelB,
          group: undefined,
          actor: taro.id,
        }),
      ).toEqual({ ok: false, error: { kind: 'notFound' } })
    })

    it('その場の対応先でない Group では解除できない', () => {
      expect(
        PlaceMapping.release({
          mappings: mapped,
          place: channelA,
          group: hokkaido,
          actor: taro.id,
        }),
      ).toEqual({ ok: false, error: { kind: 'notFound' } })
    })

    it('他の場の対応は変わらない', () => {
      const both = assigned({ mappings: mapped, place: channelB, group: okinawa, actor: taro.id })
      const released = PlaceMapping.release({
        mappings: both,
        place: channelA,
        group: okinawa,
        actor: taro.id,
      })

      expect(released.ok && PlaceMapping.resolve(released.value, channelB)).toBe(okinawa.id)
    })

    it('Group 自体は消えない', () => {
      PlaceMapping.release({ mappings: mapped, place: channelA, group: okinawa, actor: taro.id })

      expect(okinawa.members).toHaveLength(1)
      expect(okinawa.inviteCode).toBe('invite-g1')
    })
  })
})

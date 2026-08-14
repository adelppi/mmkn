import { describe, expect, it } from 'vitest'
import type { Place } from '../../domain/group/place-mapping'
import { toGroupId } from '../../domain/id'
import { fakePlaceMappingRepository } from '../port/fake'
import { resolvePlace } from './resolve-place'

/**
 * 場から対象の Group を解決する
 * （`docs/domain/group.md`「Group と外部サービスの場」「対応づけられていない場から操作したとき」）。
 */

const okinawa: Place = { service: 'discord', id: 'channel-1' }
const hokkaido: Place = { service: 'discord', id: 'channel-2' }

describe('場から対象の Group を解決する', () => {
  it('対応づけられていれば、その Group の識別子が返る', async () => {
    const deps = {
      placeMappings: fakePlaceMappingRepository([{ place: okinawa, groupId: toGroupId('g1') }]),
    }

    const result = await resolvePlace(deps)({ place: okinawa })

    expect(result).toEqual({ ok: true, value: { group: toGroupId('g1') } })
  })

  it('対応づけられていなければ失敗する。対象の Group が自動的に選ばれることはない', async () => {
    const deps = {
      placeMappings: fakePlaceMappingRepository([{ place: hokkaido, groupId: toGroupId('g1') }]),
    }

    const result = await resolvePlace(deps)({ place: okinawa })

    expect(result).toEqual({ ok: false, error: { kind: 'placeNotAssigned' } })
  })

  it('同じ識別子でもサービスが違えば別の場として扱う', async () => {
    const deps = {
      placeMappings: fakePlaceMappingRepository([{ place: okinawa, groupId: toGroupId('g1') }]),
    }

    const result = await resolvePlace(deps)({ place: { service: 'slack', id: okinawa.id } })

    expect(result).toEqual({ ok: false, error: { kind: 'placeNotAssigned' } })
  })
})

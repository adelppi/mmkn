import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Place } from '../../../domain/group/place-mapping'
import { toGroupId } from '../../../domain/id'
import { groupOf, jiro, taro } from '../../../usecase/fixture'
import { connectForTest, truncateAll, type TestDatabase } from '../test-support'
import { drizzleGroupRepository } from './group'
import { drizzlePlaceMappingRepository } from './place-mapping'
import { drizzleUserRepository } from './user'

/** 場と Group の対応の永続化。 */

const okinawa: Place = { service: 'discord', id: 'channel-1' }
const hokkaido: Place = { service: 'discord', id: 'channel-2' }
/** サービスが違えば、同じ場の識別子でも別の場（鍵は組で決まる）。 */
const otherService: Place = { service: 'slack', id: 'channel-1' }

let database: TestDatabase

beforeAll(async () => {
  database = await connectForTest()
})

afterAll(async () => {
  await database.close()
})

beforeEach(async () => {
  await truncateAll(database.db)

  const users = drizzleUserRepository(database.db)
  await users.create(taro)
  await users.create(jiro)

  const groups = drizzleGroupRepository(database.db)
  await groups.create(groupOf([{ user: taro, memberId: 'm1' }]))
  await groups.create(groupOf([{ user: jiro, memberId: 'm2' }], { id: 'g2', inviteCode: 'invite-2' }))
})

const repository = () => drizzlePlaceMappingRepository(database.db)

describe('場と Group の対応', () => {
  it('読み戻せる', async () => {
    await repository().save({ place: okinawa, groupId: toGroupId('g1') })

    expect(await repository().find(okinawa)).toEqual({ place: okinawa, groupId: toGroupId('g1') })
  })

  it('対応づけられていない場は undefined', async () => {
    expect(await repository().find(okinawa)).toBeUndefined()
  })

  it('同じ場に別の Group を対応づけると、置き換わる', async () => {
    await repository().save({ place: okinawa, groupId: toGroupId('g1') })

    await repository().save({ place: okinawa, groupId: toGroupId('g2') })

    expect((await repository().find(okinawa))?.groupId).toBe(toGroupId('g2'))
  })

  it('1 つの Group が複数の場に対応してよい', async () => {
    await repository().save({ place: okinawa, groupId: toGroupId('g1') })
    await repository().save({ place: hokkaido, groupId: toGroupId('g1') })

    expect((await repository().find(okinawa))?.groupId).toBe(toGroupId('g1'))
    expect((await repository().find(hokkaido))?.groupId).toBe(toGroupId('g1'))
  })

  it('サービスが違えば、同じ識別子でも別の場として扱う', async () => {
    await repository().save({ place: okinawa, groupId: toGroupId('g1') })
    await repository().save({ place: otherService, groupId: toGroupId('g2') })

    expect((await repository().find(okinawa))?.groupId).toBe(toGroupId('g1'))
    expect((await repository().find(otherService))?.groupId).toBe(toGroupId('g2'))
  })

  it('解除すると対応が消え、他の場の対応は残る', async () => {
    await repository().save({ place: okinawa, groupId: toGroupId('g1') })
    await repository().save({ place: hokkaido, groupId: toGroupId('g1') })

    await repository().remove(okinawa)

    expect(await repository().find(okinawa)).toBeUndefined()
    expect(await repository().find(hokkaido)).toBeDefined()
  })

  it('解除しても Group は消えない', async () => {
    await repository().save({ place: okinawa, groupId: toGroupId('g1') })

    await repository().remove(okinawa)

    expect(await drizzleGroupRepository(database.db).findById(toGroupId('g1'))).toBeDefined()
  })
})

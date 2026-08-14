import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { toGroupId, toMemberId, toTransferId } from '../../../domain/id'
import { Transfer } from '../../../domain/record/transfer'
import { groupOf, jiro, taro } from '../../../usecase/fixture'
import { connectForTest, truncateAll, type TestDatabase } from '../test-support'
import { drizzleGroupRepository } from './group'
import { drizzleTransferRepository } from './transfer'
import { drizzleUserRepository } from './user'

/**
 * Transfer の永続化。
 *
 * ここで固定するのは Payment と同じ 2 点（読み戻せること・**楽観ロックが競合を弾くこと**）。
 */

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

  await drizzleGroupRepository(database.db).create(
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
  )
})

const repository = () => drizzleTransferRepository(database.db)

const transferOf = (overrides: { id?: string; amount?: number; currency?: string } = {}) => {
  const group = groupOf([
    { user: taro, memberId: 'm1' },
    { user: jiro, memberId: 'm2' },
  ])

  const transfer = Transfer.create({
    id: toTransferId(overrides.id ?? 't1'),
    group,
    sender: toMemberId('m1'),
    recipient: toMemberId('m2'),
    amount: overrides.amount ?? 5_000,
    currency: overrides.currency ?? 'JPY',
    occurredOn: '2026-08-14',
    recordedBy: taro.id,
    recordedAt: new Date('2026-08-14T09:00:00.000Z'),
  })
  if (!transfer.ok) throw new Error('前提の Transfer を作れなかった')
  return transfer.value
}

describe('Transfer の保存と読み出し', () => {
  it('読み戻せる', async () => {
    const transfer = transferOf()

    const version = await repository().create(transfer)

    expect(await repository().find(transfer.id)).toEqual({ record: transfer, version })
  })

  it('最小単位の桁数が違う通貨も、そのまま読み戻せる', async () => {
    // 内部の扱いは通貨で変わらない（`docs/domain/money.md`「境界・例外ケース」）。
    const transfer = transferOf({ currency: 'USD', amount: 1_050 })

    await repository().create(transfer)

    expect((await repository().find(transfer.id))?.record.money).toEqual({
      amount: 1_050,
      currency: 'USD',
    })
  })

  it('グループ単位で読める', async () => {
    await repository().create(transferOf({ id: 't1' }))
    await repository().create(transferOf({ id: 't2' }))

    const found = await repository().listByGroup(toGroupId('g1'))

    expect(found).toHaveLength(2)
  })

  it('存在しない Transfer は undefined', async () => {
    expect(await repository().find(toTransferId('いない'))).toBeUndefined()
  })
})

describe('楽観ロック', () => {
  it('見ていた版と一致すれば更新でき、版が進む', async () => {
    const transfer = transferOf()
    const version = await repository().create(transfer)

    const written = await repository().update(transferOf({ amount: 3_000 }), version)

    expect(written).toEqual({ kind: 'written', version: 2 })
    expect((await repository().find(transfer.id))?.record.money.amount).toBe(3_000)
  })

  it('古い版で更新しようとすると弾かれ、内容は変わらない', async () => {
    const transfer = transferOf()
    const seen = await repository().create(transfer)

    await repository().update(transferOf({ amount: 3_000 }), seen)
    const late = await repository().update(transferOf({ amount: 9_000 }), seen)

    expect(late).toEqual({ kind: 'stale' })
    expect((await repository().find(transfer.id))?.record.money.amount).toBe(3_000)
  })

  it('古い版で削除しようとすると弾かれ、記録は残る', async () => {
    const transfer = transferOf()
    const seen = await repository().create(transfer)

    await repository().update(transferOf({ amount: 3_000 }), seen)

    expect(await repository().remove(transfer.id, seen)).toEqual({ kind: 'stale' })
    expect(await repository().find(transfer.id)).toBeDefined()
  })

  it('見ていた版と一致すれば削除できる', async () => {
    const transfer = transferOf()
    const version = await repository().create(transfer)

    expect(await repository().remove(transfer.id, version)).toEqual({ kind: 'deleted' })
    expect(await repository().find(transfer.id)).toBeUndefined()
  })
})

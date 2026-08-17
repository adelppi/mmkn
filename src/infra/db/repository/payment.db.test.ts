import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { toGroupId, toMemberId, toPaymentId } from '../../../domain/id'
import { Payment } from '../../../domain/record/payment'
import { groupOf, jiro, taro } from '../../../usecase/fixture'
import { paymentBearers } from '../schema'
import { connectForTest, truncateAll, type TestDatabase } from '../test-support'
import { drizzleGroupRepository } from './group'
import { drizzlePaymentRepository } from './payment'
import { drizzleUserRepository } from './user'

/**
 * Payment 集約の永続化。
 *
 * ここで固定するもの（`docs/adr/0010-testing.md`「実 DB を使うテスト」）：
 * - 集約単位（Payment とその負担者）の保存が成立すること
 * - **楽観ロックが実際に競合を弾くこと**
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

const repository = () => drizzlePaymentRepository(database.db)

const paymentOf = (overrides: { id?: string; amount?: number; bearers?: string[] } = {}) => {
  const group = groupOf([
    { user: taro, memberId: 'm1' },
    { user: jiro, memberId: 'm2' },
  ])

  const payment = Payment.create({
    id: toPaymentId(overrides.id ?? 'p1'),
    group,
    payer: toMemberId('m1'),
    bearers: (overrides.bearers ?? ['m1', 'm2']).map(toMemberId),
    amount: overrides.amount ?? 10_000,
    currency: 'JPY',
    occurredOn: '2026-08-14',
    description: '夕食',
    recordedBy: taro.id,
    recordedAt: new Date('2026-08-14T09:00:00.000Z'),
  })
  if (!payment.ok) throw new Error('前提の Payment を作れなかった')
  return payment.value
}

describe('Payment 集約の保存と読み出し', () => {
  it('Payment と、その負担者をひとまとまりで読み戻せる', async () => {
    const payment = paymentOf()

    const version = await repository().create(payment)
    const found = await repository().find(payment.id)

    expect(version).toBe(1)
    expect(found).toEqual({ record: payment, version: 1 })
  })

  it('負担額は保存せず、金額と負担者から導出する', async () => {
    await repository().create(paymentOf({ amount: 10_001 }))

    const found = await repository().find(toPaymentId('p1'))
    if (found === undefined) throw new Error('読み戻せなかった')

    // 端数は配分順序の先頭に寄る。保存された値ではなく、そのつどの導出結果。
    expect(Payment.shares(found.record)).toEqual([
      { bearer: toMemberId('m1'), amount: 5_001 },
      { bearer: toMemberId('m2'), amount: 5_000 },
    ])
  })

  it('グループ単位で読める', async () => {
    await repository().create(paymentOf({ id: 'p1' }))
    await repository().create(paymentOf({ id: 'p2' }))

    const found = await repository().listByGroup(toGroupId('g1'))

    expect(found.map((it) => it.record.id).sort()).toEqual([toPaymentId('p1'), toPaymentId('p2')])
    expect(found.every((it) => it.record.bearers.length === 2)).toBe(true)
  })

  it('記録が 1 件も無ければ空', async () => {
    expect(await repository().listByGroup(toGroupId('g1'))).toEqual([])
  })

  it('負担者の行が無い Payment も、一覧から落ちない', async () => {
    // 負担者のいない Payment はドメインが作らせない（`docs/domain/record.md`「支払者と負担者」）。
    // Payment と負担者を一度に読む形が、負担者の無い記録を消してしまわないことを確かめる。
    await repository().create(paymentOf())
    await database.db.delete(paymentBearers).where(eq(paymentBearers.paymentId, 'p1'))

    const found = await repository().listByGroup(toGroupId('g1'))

    expect(found.map((it) => it.record.id)).toEqual([toPaymentId('p1')])
    expect(found[0]?.record.bearers).toEqual([])
  })

  it('存在しない Payment は undefined', async () => {
    expect(await repository().find(toPaymentId('いない'))).toBeUndefined()
  })
})

describe('楽観ロック', () => {
  it('見ていた版と一致すれば更新でき、版が進む', async () => {
    const payment = paymentOf()
    const version = await repository().create(payment)

    const written = await repository().update({ ...payment, description: '朝食' }, version)

    expect(written).toEqual({ kind: 'written', version: 2 })
    expect((await repository().find(payment.id))?.record.description).toBe('朝食')
  })

  it('古い版で更新しようとすると弾かれ、内容は変わらない', async () => {
    const payment = paymentOf()
    const seen = await repository().create(payment)

    await repository().update({ ...payment, description: '先' }, seen)
    const late = await repository().update({ ...payment, description: '後' }, seen)

    expect(late).toEqual({ kind: 'stale' })
    expect((await repository().find(payment.id))?.record.description).toBe('先')
  })

  it('古い版で削除しようとすると弾かれ、記録は残る', async () => {
    const payment = paymentOf()
    const seen = await repository().create(payment)

    await repository().update({ ...payment, description: '先' }, seen)
    const removed = await repository().remove(payment.id, seen)

    expect(removed).toEqual({ kind: 'stale' })
    expect(await repository().find(payment.id)).toBeDefined()
  })

  it('見ていた版と一致すれば削除でき、負担者も一緒に消える', async () => {
    const payment = paymentOf()
    const version = await repository().create(payment)

    const removed = await repository().remove(payment.id, version)

    expect(removed).toEqual({ kind: 'deleted' })
    expect(await repository().find(payment.id)).toBeUndefined()

    // 負担者が孤児として残っていないことを、集約の外から確かめる。
    expect(await database.db.select().from(paymentBearers)).toEqual([])
  })

  it('負担者を入れ替える更新で、古い負担者が残らない', async () => {
    const payment = paymentOf({ bearers: ['m1', 'm2'] })
    const version = await repository().create(payment)

    const written = await repository().update(paymentOf({ bearers: ['m2'] }), version)

    expect(written.kind).toBe('written')
    expect((await repository().find(payment.id))?.record.bearers).toEqual([toMemberId('m2')])
  })
})

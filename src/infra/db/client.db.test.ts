import { connect, createServer, type AddressInfo, type Server, type Socket } from 'node:net'
import { afterAll, beforeAll, expect, describe, it } from 'vitest'
import { toGroupId, toMemberId, toPaymentId, toUserId } from '../../domain/id'
import { groupOf, jiro, taro } from '../../usecase/fixture'
import { listGroups } from '../../usecase/group/list-groups'
import { listRecords } from '../../usecase/record/list-records'
import { Payment } from '../../domain/record/payment'
import { createClient, createDatabase, type Database } from './client'
import { drizzleGroupRepository } from './repository/group'
import { drizzlePaymentRepository } from './repository/payment'
import { drizzleTransferRepository } from './repository/transfer'
import { drizzleUserRepository } from './repository/user'
import { connectForTest, truncateAll, type TestDatabase } from './test-support'

/**
 * DB との往復の数（`docs/adr/0005-data-access-and-authorization.md`「ORM とドライバ」）。
 *
 * **増えても失敗せず、遅くなるだけである。** 他のテストには現れないため、ここで数える。
 * 間に中継を挟み、接続ごとに「返事を受け取ったあとに、また送った」回数を数えて足す。
 * **並んだ問い合わせも 1 本ずつ数える**ため、待つ段数ではなく往復の総数になる。
 */

let database: TestDatabase
let relay: Server
let db: Database
let close: () => Promise<void>

/** 接続ごとの往復の数。 */
const turns = new Map<Socket, number>()

const relayTo = (host: string, port: number): Server =>
  createServer((downstream) => {
    const upstream = connect(port, host)
    let waiting = false

    downstream.on('data', (chunk) => {
      if (!waiting) turns.set(downstream, (turns.get(downstream) ?? 0) + 1)
      waiting = true
      upstream.write(chunk)
    })
    upstream.on('data', (chunk) => {
      waiting = false
      downstream.write(chunk)
    })

    for (const [from, to] of [
      [downstream, upstream],
      [upstream, downstream],
    ] as const) {
      from.on('close', () => to.destroy())
      from.on('error', () => to.destroy())
    }
  })

/** 動かした間に起きた往復の数。 */
const roundTrips = async (run: () => Promise<unknown>): Promise<number> => {
  turns.clear()
  await run()
  return [...turns.values()].reduce((total, count) => total + count, 0)
}

const repositories = () => ({
  users: drizzleUserRepository(db),
  groups: drizzleGroupRepository(db),
  payments: drizzlePaymentRepository(db),
  transfers: drizzleTransferRepository(db),
})

const members = [
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
]

beforeAll(async () => {
  database = await connectForTest()
  await truncateAll(database.db)

  const target = new URL(process.env.DATABASE_URL ?? '')
  relay = relayTo(target.hostname, Number(target.port || 5432))
  await new Promise<void>((resolve) => relay.listen(0, '127.0.0.1', resolve))

  target.hostname = '127.0.0.1'
  target.port = String((relay.address() as AddressInfo).port)

  const client = createClient(target.toString())
  db = createDatabase(client)
  close = () => client.end()

  const { users, groups, payments } = repositories()
  await users.create(taro)
  await users.create(jiro)
  await groups.create(groupOf(members))

  const payment = Payment.create({
    id: toPaymentId('p1'),
    group: groupOf(members),
    payer: toMemberId('m1'),
    bearers: [toMemberId('m1'), toMemberId('m2')],
    amount: 1_000,
    currency: 'JPY',
    occurredOn: '2026-08-14',
    description: '夕食',
    recordedBy: taro.id,
    recordedAt: new Date('2026-08-14T09:00:00.000Z'),
  })
  if (!payment.ok) throw new Error('前提の Payment を作れなかった')
  await payments.create(payment.value)

  // **接続を張る往復を数えない。** 並ぶ数だけ先に張っておく。
  await Promise.all([users.findById(taro.id), users.findById(jiro.id)])
})

afterAll(async () => {
  await close()
  await new Promise((resolve) => relay.close(resolve))
  await database.close()
})

describe('DB との往復の数', () => {
  it('引数のある問い合わせ 1 本は、1 往復で済む', async () => {
    const { users, groups } = repositories()

    expect(await roundTrips(() => users.findById(toUserId('いない')))).toBe(1)
    expect(await roundTrips(() => groups.findById(toGroupId('g1')))).toBe(1)
    expect(await roundTrips(() => groups.listByUser(taro.id))).toBe(1)
  })

  it('支払いと負担者を、1 往復で読む', async () => {
    const { payments } = repositories()

    expect(await roundTrips(() => payments.find(toPaymentId('p1')))).toBe(1)
  })

  it('読むグループが無ければ、問い合わせない', async () => {
    const { payments, transfers } = repositories()

    expect(await roundTrips(() => payments.listByGroups([]))).toBe(0)
    expect(await roundTrips(() => transfers.listByGroups([]))).toBe(0)
  })

  it('グループ一覧は、User・グループ・支払い・送金の 4 本で読む', async () => {
    const run = () => listGroups(repositories())({ actor: taro.id })

    expect(await roundTrips(run)).toBe(4)
  })

  it('記録一覧は、グループ・支払い・送金の 3 本で読む', async () => {
    const run = () => listRecords(repositories())({ actor: taro.id, group: toGroupId('g1') })

    expect(await roundTrips(run)).toBe(3)
  })
})

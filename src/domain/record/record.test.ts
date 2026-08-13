import { describe, expect, it } from 'vitest'
import { Group } from '../group/group'
import { User } from '../group/user'
import { toGroupId, toMemberId, toPaymentId, toTransferId, toUserId } from '../id'
import { plainDate, type PlainDate } from './date'
import { Payment } from './payment'
import { compareRecords, sortRecords, type AnyRecord } from './record'
import { Transfer } from './transfer'

const dateOf = (raw: string): PlainDate => {
  const result = plainDate(raw)
  if (!result.ok) throw new Error(`前提の日付を作れなかった: ${raw}`)
  return result.value
}

/** 並びに要るものだけを持つ記録。`compareRecords` が見るのはこの 3 つ。 */
const recordOf = (id: string, occurredOn: string, recordedAt: string) => ({
  id: toPaymentId(id),
  occurredOn: dateOf(occurredOn),
  recordedAt: new Date(recordedAt),
})

const ids = (records: readonly { id: string }[]) => records.map((record) => record.id)

describe('記録の並び', () => {
  it('発生日の新しい順に並ぶ', () => {
    const records = [
      recordOf('p1', '2026-08-11', '2026-08-11T00:00:00.000Z'),
      recordOf('p2', '2026-08-13', '2026-08-13T00:00:00.000Z'),
      recordOf('p3', '2026-08-12', '2026-08-12T00:00:00.000Z'),
    ]

    expect(ids(sortRecords(records))).toEqual(['p2', 'p3', 'p1'])
  })

  it('同じ発生日は、後から登録したものが先', () => {
    const records = [
      recordOf('p1', '2026-08-13', '2026-08-13T01:00:00.000Z'),
      recordOf('p2', '2026-08-13', '2026-08-13T03:00:00.000Z'),
      recordOf('p3', '2026-08-13', '2026-08-13T02:00:00.000Z'),
    ]

    expect(ids(sortRecords(records))).toEqual(['p2', 'p3', 'p1'])
  })

  it('発生日が優先され、登録日時はその中でだけ効く', () => {
    const records = [
      // 発生日は古いが、登録は新しい
      recordOf('p1', '2026-08-11', '2026-08-20T00:00:00.000Z'),
      recordOf('p2', '2026-08-13', '2026-08-13T00:00:00.000Z'),
    ]

    expect(ids(sortRecords(records))).toEqual(['p2', 'p1'])
  })

  it('未来の発生日も、そのまま新しいものとして並ぶ', () => {
    const records = [
      recordOf('p1', '2026-08-13', '2026-08-13T00:00:00.000Z'),
      recordOf('p2', '2999-12-31', '2026-08-13T00:00:00.000Z'),
    ]

    expect(ids(sortRecords(records))).toEqual(['p2', 'p1'])
  })

  it('発生日も登録日時も同じなら、記録の同一性で並びが一意に決まる', () => {
    const same = (id: string) => recordOf(id, '2026-08-13', '2026-08-13T00:00:00.000Z')
    const records = [same('p3'), same('p1'), same('p2')]

    expect(ids(sortRecords(records))).toEqual(ids(sortRecords([same('p1'), same('p2'), same('p3')])))
    expect(new Set(ids(sortRecords(records)))).toEqual(new Set(['p1', 'p2', 'p3']))
  })

  it('同じ列を何度並べ替えても結果が変わらない', () => {
    const records = [
      recordOf('p1', '2026-08-13', '2026-08-13T00:00:00.000Z'),
      recordOf('p2', '2026-08-13', '2026-08-13T00:00:00.000Z'),
      recordOf('p3', '2026-08-12', '2026-08-13T00:00:00.000Z'),
    ]

    expect(ids(sortRecords(records))).toEqual(ids(sortRecords([...records].reverse())))
  })

  it('元の配列を書き換えない', () => {
    const records = [
      recordOf('p1', '2026-08-11', '2026-08-11T00:00:00.000Z'),
      recordOf('p2', '2026-08-13', '2026-08-13T00:00:00.000Z'),
    ]
    sortRecords(records)

    expect(ids(records)).toEqual(['p1', 'p2'])
  })

  describe('Payment と Transfer をまとめて 1 つの列として扱う', () => {
    const taro = (() => {
      const user = User.create({
        id: toUserId('u1'),
        name: 'たろう',
        loginIdentifier: 'google:u1',
      })
      if (!user.ok) throw new Error('前提の User を作れなかった')
      return user.value
    })()

    const jiro = (() => {
      const user = User.create({
        id: toUserId('u2'),
        name: 'じろう',
        loginIdentifier: 'google:u2',
      })
      if (!user.ok) throw new Error('前提の User を作れなかった')
      return user.value
    })()

    const m1 = toMemberId('m1')
    const m2 = toMemberId('m2')

    const group = (() => {
      const created = Group.create({
        id: toGroupId('g1'),
        name: '沖縄旅行',
        defaultCurrency: 'JPY',
        inviteCode: 'invite-1',
        creator: taro,
        creatorMemberId: m1,
      })
      if (!created.ok) throw new Error('前提の Group を作れなかった')

      const joined = Group.join(created.value, { memberId: m2, user: jiro, displayName: 'じろう' })
      if (!joined.ok) throw new Error('前提の参加に失敗した')
      return joined.value
    })()

    const payment = (() => {
      const result = Payment.create({
        id: toPaymentId('p1'),
        group,
        payer: m1,
        bearers: [m1, m2],
        amount: 10000,
        currency: 'JPY',
        occurredOn: '2026-08-11',
        description: '夕食',
        recordedBy: taro.id,
        recordedAt: new Date('2026-08-11T00:00:00.000Z'),
      })
      if (!result.ok) throw new Error('前提の Payment を作れなかった')
      return result.value
    })()

    const transfer = (() => {
      const result = Transfer.create({
        id: toTransferId('t1'),
        group,
        sender: m2,
        recipient: m1,
        amount: 5000,
        currency: 'JPY',
        occurredOn: '2026-08-13',
        recordedBy: jiro.id,
        recordedAt: new Date('2026-08-13T00:00:00.000Z'),
      })
      if (!result.ok) throw new Error('前提の Transfer を作れなかった')
      return result.value
    })()

    it('種類によって分けず、発生日の新しい順に混ざる', () => {
      const records: readonly AnyRecord[] = [payment, transfer]

      expect(sortRecords(records).map((record) => record.id)).toEqual([transfer.id, payment.id])
    })

    it('Payment と Transfer を比べられる', () => {
      expect(compareRecords(transfer, payment)).toBeLessThan(0)
      expect(compareRecords(payment, transfer)).toBeGreaterThan(0)
    })
  })
})

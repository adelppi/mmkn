import { describe, expect, it } from 'vitest'
import { Group } from '../group/group'
import { User } from '../group/user'
import { toGroupId, toMemberId, toPaymentId, toTransferId, toUserId } from '../id'
import { Payment } from '../record/payment'
import { Transfer } from '../record/transfer'
import { balancesOf, type CurrencyBalances } from './balance'

const userOf = (id: string, name: string) => {
  const user = User.create({ id: toUserId(id), name, loginIdentifier: `auth-${id}` })
  if (!user.ok) throw new Error('前提の User を作れなかった')
  return user.value
}

const taro = userOf('u1', 'たろう')
const jiro = userOf('u2', 'じろう')
const saburo = userOf('u3', 'さぶろう')

const m1 = toMemberId('m1')
const m2 = toMemberId('m2')
const m3 = toMemberId('m3')

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

  return [
    { memberId: m2, user: jiro, displayName: 'じろう' },
    { memberId: m3, user: saburo, displayName: 'さぶろう' },
  ].reduce((acc, input) => {
    const joined = Group.join(acc, input)
    if (!joined.ok) throw new Error('前提の参加に失敗した')
    return joined.value
  }, created.value)
})()

let sequence = 0

const payment = (input: {
  payer: ReturnType<typeof toMemberId>
  bearers: readonly ReturnType<typeof toMemberId>[]
  amount: number
  currency?: string
  occurredOn?: string
}) => {
  sequence += 1
  const result = Payment.create({
    id: toPaymentId(`p${sequence}`),
    group,
    payer: input.payer,
    bearers: input.bearers,
    amount: input.amount,
    currency: input.currency ?? 'JPY',
    occurredOn: input.occurredOn ?? '2026-08-13',
    description: '',
    recordedBy: taro.id,
    recordedAt: new Date('2026-08-13T00:00:00.000Z'),
  })
  if (!result.ok) throw new Error('前提の Payment を作れなかった')
  return result.value
}

const transfer = (input: {
  sender: ReturnType<typeof toMemberId>
  recipient: ReturnType<typeof toMemberId>
  amount: number
  currency?: string
}) => {
  sequence += 1
  const result = Transfer.create({
    id: toTransferId(`t${sequence}`),
    group,
    sender: input.sender,
    recipient: input.recipient,
    amount: input.amount,
    currency: input.currency ?? 'JPY',
    occurredOn: '2026-08-13',
    recordedBy: taro.id,
    recordedAt: new Date('2026-08-13T00:00:00.000Z'),
  })
  if (!result.ok) throw new Error('前提の Transfer を作れなかった')
  return result.value
}

const none = { payments: [], transfers: [] }

const forCurrency = (balances: readonly CurrencyBalances[], currency: string) =>
  balances.find((it) => it.currency === currency)?.balances ?? []

const sum = (balances: readonly { amount: number }[]) =>
  balances.reduce((acc, balance) => acc + balance.amount, 0)

describe('収支', () => {
  describe('Payment が生む収支', () => {
    it('支払者はプラス、負担者はマイナス', () => {
      const balances = balancesOf({
        payments: [payment({ payer: m1, bearers: [m1, m2], amount: 10000 })],
        transfers: [],
      })

      expect(forCurrency(balances, 'JPY')).toEqual([
        { member: m1, amount: 5000 },
        { member: m2, amount: -5000 },
      ])
    })

    it('支払者が負担者に含まれない場合、金額の分だけプラスになる', () => {
      const balances = balancesOf({
        payments: [payment({ payer: m1, bearers: [m2, m3], amount: 10000 })],
        transfers: [],
      })

      expect(forCurrency(balances, 'JPY')).toEqual([
        { member: m1, amount: 10000 },
        { member: m2, amount: -5000 },
        { member: m3, amount: -5000 },
      ])
    })

    it('端数は負担額の配分ルールのまま収支に入る', () => {
      const balances = balancesOf({
        payments: [payment({ payer: m1, bearers: [m1, m2, m3], amount: 10000 })],
        transfers: [],
      })

      // 配分は 3334 / 3333 / 3333（`docs/domain/record.md`「負担額の配分」）。
      expect(forCurrency(balances, 'JPY')).toEqual([
        { member: m1, amount: 6666 },
        { member: m2, amount: -3333 },
        { member: m3, amount: -3333 },
      ])
    })
  })

  describe('Transfer が生む収支', () => {
    it('送り手はプラス、受け手はマイナス', () => {
      // お金を出した側がプラスになる（`docs/domain/settlement.md`「Transfer が生む収支」）。
      const balances = balancesOf({
        payments: [],
        transfers: [transfer({ sender: m1, recipient: m2, amount: 2000 })],
      })

      expect(forCurrency(balances, 'JPY')).toEqual([
        { member: m1, amount: 2000 },
        { member: m2, amount: -2000 },
      ])
    })

    it('清算案が示すとおりに送ると、収支が 0 に近づく', () => {
      const paid = payment({ payer: m1, bearers: [m1, m2], amount: 10000 })

      // m1 +5000 / m2 −5000 の状態で、m2 が m1 へ 5000 送る
      const balances = balancesOf({
        payments: [paid],
        transfers: [transfer({ sender: m2, recipient: m1, amount: 5000 })],
      })

      expect(forCurrency(balances, 'JPY')).toEqual([
        { member: m1, amount: 0 },
        { member: m2, amount: 0 },
      ])
    })

    it('Payment と Transfer を合わせて 1 つの収支になる', () => {
      const balances = balancesOf({
        payments: [payment({ payer: m1, bearers: [m1, m2], amount: 10000 })],
        transfers: [transfer({ sender: m2, recipient: m1, amount: 5000 })],
      })

      expect(forCurrency(balances, 'JPY')).toEqual([
        { member: m1, amount: 0 },
        { member: m2, amount: 0 },
      ])
    })
  })

  describe('収支の性質', () => {
    it('1 つの通貨について、収支の合計は必ず 0 になる', () => {
      const balances = balancesOf({
        payments: [
          payment({ payer: m1, bearers: [m1, m2, m3], amount: 10000 }),
          payment({ payer: m2, bearers: [m2, m3], amount: 7777 }),
        ],
        transfers: [transfer({ sender: m3, recipient: m1, amount: 1234 })],
      })

      for (const perCurrency of balances) {
        expect(sum(perCurrency.balances), perCurrency.currency).toBe(0)
      }
    })

    it('Member が 1 人だけなら、その Member の収支は常に 0 になる', () => {
      const balances = balancesOf({
        payments: [payment({ payer: m1, bearers: [m1], amount: 10000 })],
        transfers: [],
      })

      expect(forCurrency(balances, 'JPY')).toEqual([{ member: m1, amount: 0 }])
    })

    it('同じ記録からは何度導出しても同じ収支になる', () => {
      const records = {
        payments: [payment({ payer: m1, bearers: [m1, m2, m3], amount: 10000 })],
        transfers: [],
      }

      expect(balancesOf(records)).toEqual(balancesOf(records))
    })
  })

  describe('通貨ごとに独立して導出する', () => {
    it('通貨をまたいで合算しない', () => {
      const balances = balancesOf({
        payments: [
          payment({ payer: m1, bearers: [m1, m2], amount: 10000, currency: 'JPY' }),
          payment({ payer: m2, bearers: [m1, m2], amount: 100, currency: 'USD' }),
        ],
        transfers: [],
      })

      expect(balances.map((it) => it.currency)).toEqual(['JPY', 'USD'])
      expect(forCurrency(balances, 'JPY')).toEqual([
        { member: m1, amount: 5000 },
        { member: m2, amount: -5000 },
      ])
      expect(forCurrency(balances, 'USD')).toEqual([
        { member: m1, amount: -50 },
        { member: m2, amount: 50 },
      ])
    })

    it('通貨が混在してもエラーにならない', () => {
      expect(() =>
        balancesOf({
          payments: [
            payment({ payer: m1, bearers: [m2], amount: 1, currency: 'JPY' }),
            payment({ payer: m1, bearers: [m2], amount: 1, currency: 'KWD' }),
          ],
          transfers: [],
        }),
      ).not.toThrow()
    })

    it('記録が存在する通貨についてのみ導出する', () => {
      const balances = balancesOf({
        payments: [payment({ payer: m1, bearers: [m2], amount: 1, currency: 'EUR' })],
        transfers: [],
      })

      expect(balances.map((it) => it.currency)).toEqual(['EUR'])
    })
  })

  describe('境界・例外ケース', () => {
    it('記録が 1 件もなければ収支は空になる', () => {
      expect(balancesOf(none)).toEqual([])
    })

    it('発生日は収支の計算に使わない', () => {
      // 未来の発生日でも、日付が来るのを待たずにそのまま反映される。
      const future = balancesOf({
        payments: [payment({ payer: m1, bearers: [m2], amount: 1000, occurredOn: '2999-12-31' })],
        transfers: [],
      })
      const past = balancesOf({
        payments: [payment({ payer: m1, bearers: [m2], amount: 1000, occurredOn: '2000-01-01' })],
        transfers: [],
      })

      expect(forCurrency(future, 'JPY')).toEqual(forCurrency(past, 'JPY'))
    })

    it('収支が 0 になった Member も落とさない', () => {
      const balances = balancesOf({
        payments: [payment({ payer: m1, bearers: [m1], amount: 1000 })],
        transfers: [],
      })

      expect(forCurrency(balances, 'JPY')).toEqual([{ member: m1, amount: 0 }])
    })
  })
})

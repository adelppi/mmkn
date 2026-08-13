import { describe, expect, it } from 'vitest'
import { Group } from '../group/group'
import { User } from '../group/user'
import { toGroupId, toMemberId, toPaymentId, toTransferId, toUserId } from '../id'
import { currency, type Currency } from '../money/currency'
import { Payment } from '../record/payment'
import { Transfer } from '../record/transfer'
import { balancesOf, type Balance, type CurrencyBalances } from './balance'
import { settle, settlementsOf, settlementTransferOf } from './settlement'

const currencyOf = (code: string): Currency => {
  const result = currency(code)
  if (!result.ok) throw new Error(`前提の通貨を作れなかった: ${code}`)
  return result.value
}

const JPY = currencyOf('JPY')
const USD = currencyOf('USD')

const m1 = toMemberId('m1')
const m2 = toMemberId('m2')
const m3 = toMemberId('m3')
const m4 = toMemberId('m4')

const balancesFor = (entries: readonly [ReturnType<typeof toMemberId>, number][]) =>
  ({
    currency: JPY,
    balances: entries.map(([member, amount]) => ({ member, amount })),
  }) satisfies CurrencyBalances

describe('清算案', () => {
  describe('導出', () => {
    it('2 人なら 1 件の送金になる', () => {
      expect(settle(balancesFor([[m1, -5000], [m2, 5000]]))).toEqual({
        currency: JPY,
        transfers: [{ sender: m1, recipient: m2, amount: 5000 }],
      })
    })

    it('マイナス側からプラス側へ送る', () => {
      const settlement = settle(balancesFor([[m1, 3000], [m2, -3000]]))

      expect(settlement.transfers).toEqual([{ sender: m2, recipient: m1, amount: 3000 }])
    })

    it('絶対値の小さいほうが送金額になる', () => {
      const settlement = settle(
        balancesFor([
          [m1, -3000],
          [m2, 10000],
          [m3, -7000],
        ]),
      )

      // 最もマイナス幅が大きいのは m3、最もプラス幅が大きいのは m2。
      expect(settlement.transfers[0]).toEqual({ sender: m3, recipient: m2, amount: 7000 })
      expect(settlement.transfers).toHaveLength(2)
    })

    it('収支が 0 の Member は対象にならない', () => {
      const settlement = settle(
        balancesFor([
          [m1, -5000],
          [m2, 0],
          [m3, 5000],
        ]),
      )

      expect(settlement.transfers).toEqual([{ sender: m1, recipient: m3, amount: 5000 }])
    })

    it('収支が 0 でない Member が n 人なら、送金は n-1 件以下に収まる', () => {
      const settlement = settle(
        balancesFor([
          [m1, -1000],
          [m2, -2000],
          [m3, 500],
          [m4, 2500],
        ]),
      )

      expect(settlement.transfers.length).toBeLessThanOrEqual(3)
    })

    it('清算案のとおりに送ると、全員の収支が 0 になる', () => {
      const before = balancesFor([
        [m1, -1000],
        [m2, -2000],
        [m3, 500],
        [m4, 2500],
      ])

      const after = new Map<string, number>(
        before.balances.map((balance) => [balance.member, balance.amount]),
      )
      for (const transfer of settle(before).transfers) {
        after.set(transfer.sender, (after.get(transfer.sender) ?? 0) + transfer.amount)
        after.set(transfer.recipient, (after.get(transfer.recipient) ?? 0) - transfer.amount)
      }

      expect([...after.values()]).toEqual([0, 0, 0, 0])
    })

    it('繰り返しの中で、受け取る側の収支が負に転じない', () => {
      const balances = balancesFor([
        [m1, -7000],
        [m2, 1000],
        [m3, 2000],
        [m4, 4000],
      ])

      const running = new Map<string, number>(
        balances.balances.map((balance) => [balance.member, balance.amount]),
      )
      for (const transfer of settle(balances).transfers) {
        const recipient = (running.get(transfer.recipient) ?? 0) - transfer.amount
        expect(recipient).toBeGreaterThanOrEqual(0)
        running.set(transfer.recipient, recipient)

        const sender = (running.get(transfer.sender) ?? 0) + transfer.amount
        expect(sender).toBeLessThanOrEqual(0)
        running.set(transfer.sender, sender)
      }
    })

    it('同じ収支からは何度導出しても同じ清算案になる', () => {
      const balances = balancesFor([
        [m1, -3000],
        [m2, -3000],
        [m3, 6000],
      ])

      expect(settle(balances)).toEqual(settle(balances))
    })

    it('同じ収支で選択が割れても、並びが揺れることはない', () => {
      const forward = settle(balancesFor([[m1, -3000], [m2, -3000], [m3, 6000]]))
      const reversed = settle(balancesFor([[m3, 6000], [m2, -3000], [m1, -3000]]))

      expect(reversed).toEqual(forward)
    })
  })

  describe('境界・例外ケース', () => {
    it('収支がすべて 0 なら清算案は空になる', () => {
      expect(settle(balancesFor([[m1, 0], [m2, 0], [m3, 0]]))).toEqual({
        currency: JPY,
        transfers: [],
      })
    })

    it('収支が空なら清算案も空になる', () => {
      expect(settle({ currency: JPY, balances: [] }).transfers).toEqual([])
    })

    it('収支が 0 でない Member がいれば、清算案には必ず 1 件以上の送金が含まれる', () => {
      expect(settle(balancesFor([[m1, -1], [m2, 1]])).transfers.length).toBeGreaterThanOrEqual(1)
    })

    it('端数が残る収支でも、送金額はすべて整数になる', () => {
      const settlement = settle(
        balancesFor([
          [m1, 6666],
          [m2, -3333],
          [m3, -3333],
        ]),
      )

      for (const transfer of settlement.transfers) {
        expect(Number.isInteger(transfer.amount)).toBe(true)
      }
      expect(settlement.transfers).toEqual([
        { sender: m2, recipient: m1, amount: 3333 },
        { sender: m3, recipient: m1, amount: 3333 },
      ])
    })

    it('収支の合計が 0 でない入力を渡されても、回り続けない', () => {
      // `balancesOf` からは起こらないが、止まることだけは確かめておく。
      const broken: readonly Balance[] = [
        { member: m1, amount: -100 },
        { member: m2, amount: 50 },
      ]

      expect(settle({ currency: JPY, balances: broken }).transfers).toEqual([
        { sender: m1, recipient: m2, amount: 50 },
      ])
    })
  })

  describe('記録から導出する', () => {
    const userOf = (id: string, name: string) => {
      const user = User.create({ id: toUserId(id), name, loginIdentifier: `google:${id}` })
      if (!user.ok) throw new Error('前提の User を作れなかった')
      return user.value
    }

    const taro = userOf('u1', 'たろう')
    const jiro = userOf('u2', 'じろう')
    const saburo = userOf('u3', 'さぶろう')

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
    }) => {
      sequence += 1
      const result = Payment.create({
        id: toPaymentId(`p${sequence}`),
        group,
        payer: input.payer,
        bearers: input.bearers,
        amount: input.amount,
        currency: input.currency ?? 'JPY',
        occurredOn: '2026-08-13',
        description: '',
        recordedBy: taro.id,
        recordedAt: new Date('2026-08-13T00:00:00.000Z'),
      })
      if (!result.ok) throw new Error('前提の Payment を作れなかった')
      return result.value
    }

    const transferOf = (input: {
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

    it('記録が 1 件もなければ清算案も無い', () => {
      expect(settlementsOf({ payments: [], transfers: [] })).toEqual([])
    })

    it('通貨ごとに独立した清算案が出る', () => {
      const settlements = settlementsOf({
        payments: [
          payment({ payer: m1, bearers: [m1, m2], amount: 10000, currency: 'JPY' }),
          payment({ payer: m2, bearers: [m1, m2], amount: 100, currency: 'USD' }),
        ],
        transfers: [],
      })

      expect(settlements).toEqual([
        { currency: JPY, transfers: [{ sender: m2, recipient: m1, amount: 5000 }] },
        { currency: USD, transfers: [{ sender: m1, recipient: m2, amount: 50 }] },
      ])
    })

    it('ある通貨の収支がすべて 0 なら、その通貨の清算案は空になる', () => {
      const settlements = settlementsOf({
        payments: [payment({ payer: m1, bearers: [m1, m2], amount: 10000 })],
        transfers: [transferOf({ sender: m2, recipient: m1, amount: 5000 })],
      })

      expect(settlements).toEqual([{ currency: JPY, transfers: [] }])
    })

    describe('清算案の送金を記録する', () => {
      const records = {
        payments: [payment({ payer: m1, bearers: [m1, m2, m3], amount: 9000 })],
        transfers: [],
      }

      it('清算案が示す額を取り出せる', () => {
        const amount = settlementTransferOf(settlementsOf(records), {
          currency: JPY,
          sender: m2,
          recipient: m1,
        })

        expect(amount).toEqual({
          ok: true,
          value: { sender: m2, recipient: m1, amount: 3000 },
        })
      })

      it('清算案に無い送り手・受け手の組なら失敗する', () => {
        // 向きが逆の組は清算案に無い。
        expect(
          settlementTransferOf(settlementsOf(records), {
            currency: JPY,
            sender: m1,
            recipient: m2,
          }),
        ).toEqual({ ok: false, error: { kind: 'settlementChanged' } })
      })

      it('清算案に無い通貨なら失敗する', () => {
        expect(
          settlementTransferOf(settlementsOf(records), {
            currency: USD,
            sender: m2,
            recipient: m1,
          }),
        ).toEqual({ ok: false, error: { kind: 'settlementChanged' } })
      })

      it('登録したあとに収支が動き、その送金は清算案から消える', () => {
        const after = {
          payments: records.payments,
          transfers: [transferOf({ sender: m2, recipient: m1, amount: 3000 })],
        }

        const balances = balancesOf(after).find((it) => it.currency === JPY)?.balances
        expect(balances).toEqual([
          { member: m1, amount: 3000 },
          { member: m2, amount: 0 },
          { member: m3, amount: -3000 },
        ])

        expect(
          settlementTransferOf(settlementsOf(after), {
            currency: JPY,
            sender: m2,
            recipient: m1,
          }),
        ).toEqual({ ok: false, error: { kind: 'settlementChanged' } })
      })

      it('表示した時点の額ではなく、その時点の記録から導出し直した額になる', () => {
        const before = settlementTransferOf(settlementsOf(records), {
          currency: JPY,
          sender: m3,
          recipient: m1,
        })

        // 表示のあとに記録が増えた
        const after = settlementTransferOf(
          settlementsOf({
            payments: [
              ...records.payments,
              payment({ payer: m3, bearers: [m1, m3], amount: 2000 }),
            ],
            transfers: [],
          }),
          { currency: JPY, sender: m3, recipient: m1 },
        )

        expect(before.ok && before.value.amount).toBe(3000)
        expect(after.ok && after.value.amount).toBe(2000)
      })

      it('部分的に送った場合は、次の清算案に残額が現れる', () => {
        // 金額を入力して Transfer を登録した場合（`docs/domain/settlement.md`）。
        const after = settlementsOf({
          payments: records.payments,
          transfers: [transferOf({ sender: m2, recipient: m1, amount: 1000 })],
        })

        expect(
          settlementTransferOf(after, { currency: JPY, sender: m2, recipient: m1 }),
        ).toEqual({ ok: true, value: { sender: m2, recipient: m1, amount: 2000 } })
      })
    })
  })
})

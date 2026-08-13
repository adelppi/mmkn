import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId } from '../../domain/id'
import { registerPayment } from '../record/register-payment'
import { registerTransfer } from '../record/register-transfer'
import { groupOf, hanako, jiro, taro } from '../fixture'
import {
  fakeClock,
  fakeGroupRepository,
  fakeIdGenerator,
  fakePaymentRepository,
  fakeTransferRepository,
} from '../port/fake'
import { registerSettlementTransfer } from './register-settlement-transfer'
import { viewSettlement } from './view-settlement'

/** 収支・清算案の表示と、清算案からの送金記録（`docs/features.md` #8〜#10）。 */

const deps = () => ({
  groups: fakeGroupRepository([
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
  ]),
  payments: fakePaymentRepository(),
  transfers: fakeTransferRepository(),
  ids: fakeIdGenerator('r'),
  clock: fakeClock(new Date('2026-08-14T09:00:00.000Z')),
})

/** たろうが 10,000 JPY 支払い、負担者は 2 人。収支は たろう +5,000 / じろう −5,000。 */
const withPayment = async (d: ReturnType<typeof deps>) => {
  const result = await registerPayment(d)({
    actor: taro.id,
    group: toGroupId('g1'),
    payer: toMemberId('m1'),
    bearers: [toMemberId('m1'), toMemberId('m2')],
    amount: 10_000,
    currency: 'JPY',
    occurredOn: '2026-08-14',
    description: '夕食',
  })
  if (!result.ok) throw new Error('前提の登録に失敗した')
  return d
}

describe('収支・清算案を見る', () => {
  it('記録が 1 件もなければ、収支も清算案も空になる', async () => {
    const d = deps()

    const result = await viewSettlement(d)({ actor: taro.id, group: toGroupId('g1') })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.balances).toEqual([])
    expect(result.value.settlements).toEqual([])
  })

  it('通貨ごとの収支と清算案が返る', async () => {
    const d = await withPayment(deps())

    const result = await viewSettlement(d)({ actor: taro.id, group: toGroupId('g1') })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.balances).toEqual([
      {
        currency: 'JPY',
        balances: [
          { member: toMemberId('m1'), amount: 5_000 },
          { member: toMemberId('m2'), amount: -5_000 },
        ],
      },
    ])
    expect(result.value.settlements).toEqual([
      {
        currency: 'JPY',
        transfers: [{ sender: toMemberId('m2'), recipient: toMemberId('m1'), amount: 5_000 }],
      },
    ])
  })

  it('データを変更しない', async () => {
    const d = await withPayment(deps())

    await viewSettlement(d)({ actor: taro.id, group: toGroupId('g1') })

    expect(d.payments.stored()).toHaveLength(1)
    expect(d.transfers.stored()).toHaveLength(0)
  })

  it('Member でなければ、収支・清算案の中身は見えない', async () => {
    const d = await withPayment(deps())

    const result = await viewSettlement(d)({ actor: hanako.id, group: toGroupId('g1') })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
  })
})

describe('清算案の送金を記録する', () => {
  it('清算案が示す額で Transfer が 1 件登録される', async () => {
    const d = await withPayment(deps())

    const result = await registerSettlementTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.record.money).toEqual({ amount: 5_000, currency: 'JPY' })
    expect(d.transfers.stored()).toHaveLength(1)
  })

  it('登録した分だけ収支が動き、次の清算案は空になる', async () => {
    const d = await withPayment(deps())

    await registerSettlementTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    const after = await viewSettlement(d)({ actor: taro.id, group: toGroupId('g1') })

    expect(after.ok && after.value.settlements).toEqual([{ currency: 'JPY', transfers: [] }])
  })

  it('金額は登録の時点で導出し直す', async () => {
    const d = await withPayment(deps())

    // 表示から登録までの間に記録が増え、清算案の額が変わる。
    await registerPayment(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      payer: toMemberId('m2'),
      bearers: [toMemberId('m1'), toMemberId('m2')],
      amount: 4_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: '朝食',
    })

    const result = await registerSettlementTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    // 表示された時点の 5,000 ではなく、導出し直した 3,000 が記録される。
    expect(result.ok && result.value.record.money.amount).toBe(3_000)
  })

  it('その送金が清算案に無ければ、登録せず清算案が変わったことを伝える', async () => {
    const d = await withPayment(deps())

    // 清算案が示すのは じろう → たろう。向きが逆のものは案に無い。
    const result = await registerSettlementTransfer(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m1'),
      recipient: toMemberId('m2'),
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'settlementChanged' } })
    expect(d.transfers.stored()).toHaveLength(0)
  })

  it('記録が 1 件もない通貨を指した場合も、清算案が変わったこととして扱う', async () => {
    const d = await withPayment(deps())

    const result = await registerSettlementTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'USD',
      occurredOn: '2026-08-14',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'settlementChanged' } })
  })

  it('扱えない通貨コードは受け付けない', async () => {
    const d = await withPayment(deps())

    const result = await registerSettlementTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'XAU',
      occurredOn: '2026-08-14',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'currencyUnsupported' } })
  })

  it('Member でなければ失敗し、記録は残らない', async () => {
    const d = await withPayment(deps())

    const result = await registerSettlementTransfer(d)({
      actor: hanako.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
    expect(d.transfers.stored()).toHaveLength(0)
  })

  it('部分送金は、この導線では登録できない', async () => {
    const d = await withPayment(deps())

    // 金額を入力する口が無いため、額を選ぶ余地そのものが無い。
    // 部分送金は通常の送金の記録で行う（`docs/domain/settlement.md`）。
    const result = await registerSettlementTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    expect(result.ok && result.value.record.money.amount).toBe(5_000)
  })

  it('登録した Transfer は、手で入力したものと同じ形になる', async () => {
    const d = await withPayment(deps())

    const fromSettlement = await registerSettlementTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })
    const byHand = await registerTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      amount: 5_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    expect(fromSettlement.ok).toBe(true)
    expect(byHand.ok).toBe(true)
    if (!fromSettlement.ok || !byHand.ok) return

    // 識別子だけが違い、それ以外は同じ。**清算案から登録したことは記録に残らない。**
    const withoutId = (record: (typeof byHand.value)['record']) => ({ ...record, id: undefined })
    expect(withoutId(fromSettlement.value.record)).toEqual(withoutId(byHand.value.record))
  })
})

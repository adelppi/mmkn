import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId } from '../../domain/id'
import { groupOf, hanako, jiro, taro } from '../fixture'
import {
  fakeClock,
  fakeGroupRepository,
  fakeIdGenerator,
  fakePaymentRepository,
  fakeTransferRepository,
} from '../port/fake'
import { registerPayment } from './register-payment'
import { registerTransfer } from './register-transfer'
import { listRecords } from './list-records'

/** 記録の一覧（`docs/domain/record.md`「記録の並び」）。 */

const deps = (at: Date = new Date('2026-08-14T09:00:00.000Z')) => ({
  groups: fakeGroupRepository([
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
    groupOf([{ user: hanako, memberId: 'm9' }], { id: 'g2', inviteCode: 'invite-2' }),
  ]),
  payments: fakePaymentRepository(),
  transfers: fakeTransferRepository(),
  ids: fakeIdGenerator('r'),
  clock: fakeClock(at),
})

describe('記録を一覧する', () => {
  it('発生日の新しい順に並ぶ', async () => {
    const d = deps()

    await registerPayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1')],
      amount: 1_000,
      currency: 'JPY',
      occurredOn: '2026-08-10',
      description: '古い',
    })
    await registerPayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1')],
      amount: 2_000,
      currency: 'JPY',
      occurredOn: '2026-08-20',
      description: '新しい',
    })

    const result = await listRecords(d)({ actor: taro.id, group: toGroupId('g1') })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.records.map((it) => it.record.occurredOn)).toEqual([
      '2026-08-20',
      '2026-08-10',
    ])
  })

  it('発生日が同じなら、後から登録したものが先に来る', async () => {
    const first = deps(new Date('2026-08-14T09:00:00.000Z'))
    const later = { ...first, clock: fakeClock(new Date('2026-08-14T10:00:00.000Z')) }

    await registerPayment(first)({
      actor: taro.id,
      group: toGroupId('g1'),
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1')],
      amount: 1_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: '先に登録',
    })
    await registerTransfer(later)({
      actor: taro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m1'),
      recipient: toMemberId('m2'),
      amount: 2_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    const result = await listRecords(first)({ actor: taro.id, group: toGroupId('g1') })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Payment と Transfer をまとめて 1 つの列として扱う。種類によって分けない。
    expect(result.value.records.map((it) => it.record.money.amount)).toEqual([2_000, 1_000])
  })

  it('記録と一緒に版が返る', async () => {
    const d = deps()

    await registerPayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1')],
      amount: 1_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: '',
    })

    const result = await listRecords(d)({ actor: taro.id, group: toGroupId('g1') })

    expect(result.ok && result.value.records[0]?.version).toBe(1)
  })

  it('他のグループの記録は混ざらない', async () => {
    const d = deps()

    await registerPayment(d)({
      actor: hanako.id,
      group: toGroupId('g2'),
      payer: toMemberId('m9'),
      bearers: [toMemberId('m9')],
      amount: 1_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: '',
    })

    const result = await listRecords(d)({ actor: taro.id, group: toGroupId('g1') })

    expect(result.ok && result.value.records).toHaveLength(0)
  })

  it('その Group の Member でなければ、記録は見えない', async () => {
    const d = deps()

    const result = await listRecords(d)({ actor: hanako.id, group: toGroupId('g1') })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
  })
})

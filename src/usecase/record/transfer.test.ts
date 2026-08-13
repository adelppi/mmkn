import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId } from '../../domain/id'
import { groupOf, hanako, jiro, taro } from '../fixture'
import {
  fakeClock,
  fakeGroupRepository,
  fakeIdGenerator,
  fakeTransferRepository,
} from '../port/fake'
import { deleteTransfer } from './delete-transfer'
import { editTransfer } from './edit-transfer'
import { registerTransfer } from './register-transfer'

/** 送金の記録・編集・削除（`docs/features.md` #6・#7）。 */

const RECORDED_AT = new Date('2026-08-14T09:00:00.000Z')

const deps = () => ({
  groups: fakeGroupRepository([
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
  ]),
  transfers: fakeTransferRepository(),
  ids: fakeIdGenerator('t'),
  clock: fakeClock(RECORDED_AT),
})

const validInput = {
  actor: taro.id,
  group: toGroupId('g1'),
  sender: toMemberId('m1'),
  recipient: toMemberId('m2'),
  amount: 5_000,
  currency: 'JPY',
  occurredOn: '2026-08-14',
}

const registered = async (d: ReturnType<typeof deps>) => {
  const result = await registerTransfer(d)(validInput)
  if (!result.ok) throw new Error('前提の登録に失敗した')
  return result.value
}

describe('送金を記録する', () => {
  it('Transfer が保存され、版が返る', async () => {
    const d = deps()

    const result = await registerTransfer(d)(validInput)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.version).toBe(1)
    expect(result.value.record.sender).toBe(toMemberId('m1'))
    expect(result.value.record.recipient).toBe(toMemberId('m2'))
    expect(result.value.record.money).toEqual({ amount: 5_000, currency: 'JPY' })
    expect(result.value.record.recordedBy).toBe(taro.id)
    expect(result.value.record.recordedAt).toEqual(RECORDED_AT)
  })

  it('送り手と受け手が同じなら失敗し、記録は残らない', async () => {
    const d = deps()

    const result = await registerTransfer(d)({ ...validInput, recipient: toMemberId('m1') })

    expect(result).toEqual({ ok: false, error: { kind: 'sameSenderAndRecipient' } })
    expect(d.transfers.stored()).toHaveLength(0)
  })

  it('グループ外への送金は扱わない', async () => {
    const d = deps()

    const result = await registerTransfer(d)({ ...validInput, recipient: toMemberId('いない') })

    expect(result).toEqual({ ok: false, error: { kind: 'recipientNotMember' } })
  })

  it('その Group の Member でなければ失敗し、記録は残らない', async () => {
    const d = deps()

    const result = await registerTransfer(d)({ ...validInput, actor: hanako.id })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
    expect(d.transfers.stored()).toHaveLength(0)
  })
})

describe('送金を編集する', () => {
  it('編集後の内容が現在の記録になり、版が進む', async () => {
    const d = deps()
    const transfer = await registered(d)

    const result = await editTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      transfer: transfer.record.id,
      version: transfer.version,
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      amount: 2_000,
      currency: 'USD',
      occurredOn: '2026-08-20',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.version).toBe(2)
    expect(result.value.record.money).toEqual({ amount: 2_000, currency: 'USD' })
    // 登録日時は取り直さない。
    expect(result.value.record.recordedAt).toEqual(RECORDED_AT)
  })

  it('後から届いた変更は失敗し、先の変更は残る', async () => {
    const d = deps()
    const transfer = await registered(d)
    const seen = transfer.version

    await editTransfer(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      transfer: transfer.record.id,
      version: seen,
      sender: toMemberId('m1'),
      recipient: toMemberId('m2'),
      amount: 3_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    const late = await editTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      transfer: transfer.record.id,
      version: seen,
      sender: toMemberId('m1'),
      recipient: toMemberId('m2'),
      amount: 9_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    expect(late).toEqual({ ok: false, error: { kind: 'versionConflict' } })
    expect(d.transfers.stored()[0]?.record.money.amount).toBe(3_000)
  })
})

describe('送金を削除する', () => {
  it('記録が完全に存在しなくなる', async () => {
    const d = deps()
    const transfer = await registered(d)

    const result = await deleteTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      transfer: transfer.record.id,
      version: transfer.version,
    })

    expect(result.ok).toBe(true)
    expect(d.transfers.stored()).toHaveLength(0)
  })

  it('古い版で削除しようとすると失敗し、記録は残る', async () => {
    const d = deps()
    const transfer = await registered(d)

    await editTransfer(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      transfer: transfer.record.id,
      version: transfer.version,
      sender: toMemberId('m1'),
      recipient: toMemberId('m2'),
      amount: 3_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })

    const result = await deleteTransfer(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      transfer: transfer.record.id,
      version: transfer.version,
    })

    expect(result).toEqual({ ok: false, error: { kind: 'versionConflict' } })
    expect(d.transfers.stored()).toHaveLength(1)
  })
})

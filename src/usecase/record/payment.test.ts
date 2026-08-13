import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId, toPaymentId } from '../../domain/id'
import { groupOf, hanako, jiro, taro } from '../fixture'
import {
  fakeClock,
  fakeGroupRepository,
  fakeIdGenerator,
  fakePaymentRepository,
} from '../port/fake'
import { deletePayment } from './delete-payment'
import { editPayment } from './edit-payment'
import { registerPayment } from './register-payment'

/** 支払いの記録・編集・削除（`docs/features.md` #5・#7）。 */

const RECORDED_AT = new Date('2026-08-14T09:00:00.000Z')

const deps = () => ({
  groups: fakeGroupRepository([
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
    groupOf([{ user: hanako, memberId: 'm9' }], { id: 'g2', inviteCode: 'invite-2' }),
  ]),
  payments: fakePaymentRepository(),
  ids: fakeIdGenerator('p'),
  clock: fakeClock(RECORDED_AT),
})

const validInput = {
  actor: taro.id,
  group: toGroupId('g1'),
  payer: toMemberId('m1'),
  bearers: [toMemberId('m1'), toMemberId('m2')],
  amount: 10_000,
  currency: 'JPY',
  occurredOn: '2026-08-14',
  description: '夕食',
}

const registered = async (d: ReturnType<typeof deps>) => {
  const result = await registerPayment(d)(validInput)
  if (!result.ok) throw new Error('前提の登録に失敗した')
  return result.value
}

describe('支払いを記録する', () => {
  it('Payment が保存され、版が返る', async () => {
    const d = deps()

    const result = await registerPayment(d)(validInput)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.version).toBe(1)
    expect(result.value.record.money).toEqual({ amount: 10_000, currency: 'JPY' })
    expect(result.value.record.description).toBe('夕食')
    expect(d.payments.stored()).toHaveLength(1)
  })

  it('登録者は操作した User、登録日時は時計から受け取る', async () => {
    const d = deps()

    const payment = await registered(d)

    // **支払者と登録者は別のもの**（`docs/domain/record.md`）。
    expect(payment.record.payer).toBe(toMemberId('m1'))
    expect(payment.record.recordedBy).toBe(taro.id)
    expect(payment.record.recordedAt).toEqual(RECORDED_AT)
  })

  it('他の Member が支払った内容も登録できる', async () => {
    const d = deps()

    const result = await registerPayment(d)({ ...validInput, actor: jiro.id })

    expect(result.ok && result.value.record.payer).toBe(toMemberId('m1'))
    expect(result.ok && result.value.record.recordedBy).toBe(jiro.id)
  })

  it('その Group の Member でなければ失敗し、記録は残らない', async () => {
    const d = deps()

    const result = await registerPayment(d)({ ...validInput, actor: hanako.id })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
    expect(d.payments.stored()).toHaveLength(0)
  })

  it('Group が存在しなければ、見つからないとして伝える', async () => {
    const d = deps()

    const result = await registerPayment(d)({ ...validInput, group: toGroupId('いない') })

    expect(result).toEqual({ ok: false, error: { kind: 'notFound' } })
  })

  it('負担者が空なら失敗し、記録は残らない', async () => {
    const d = deps()

    const result = await registerPayment(d)({ ...validInput, bearers: [] })

    expect(result).toEqual({ ok: false, error: { kind: 'bearersEmpty' } })
    expect(d.payments.stored()).toHaveLength(0)
  })

  it('他のグループの Member を負担者にできない', async () => {
    const d = deps()

    const result = await registerPayment(d)({ ...validInput, bearers: [toMemberId('m9')] })

    expect(result).toEqual({ ok: false, error: { kind: 'bearerNotMember' } })
  })

  it('未来の発生日を許す', async () => {
    const d = deps()

    const result = await registerPayment(d)({ ...validInput, occurredOn: '2099-12-31' })

    expect(result.ok && result.value.record.occurredOn).toBe('2099-12-31')
  })
})

describe('支払いを編集する', () => {
  it('編集後の内容が現在の記録になり、版が進む', async () => {
    const d = deps()
    const payment = await registered(d)

    const result = await editPayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
      payer: toMemberId('m2'),
      bearers: [toMemberId('m1')],
      amount: 5_000,
      currency: 'JPY',
      occurredOn: '2026-08-15',
      description: '朝食',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.version).toBe(2)
    expect(result.value.record.payer).toBe(toMemberId('m2'))
    expect(result.value.record.money.amount).toBe(5_000)
    expect(result.value.record.description).toBe('朝食')
  })

  it('登録日時は取り直さない', async () => {
    const d = deps()
    const payment = await registered(d)

    const result = await editPayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1')],
      amount: 5_000,
      currency: 'JPY',
      occurredOn: '2026-08-15',
      description: '朝食',
    })

    expect(result.ok && result.value.record.recordedAt).toEqual(RECORDED_AT)
  })

  it('他の Member が登録した記録も編集できる', async () => {
    const d = deps()
    const payment = await registered(d)

    const result = await editPayment(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
      payer: toMemberId('m1'),
      bearers: [toMemberId('m2')],
      amount: 10_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: '夕食',
    })

    expect(result.ok).toBe(true)
  })

  describe('同じ記録に同時に手が入ったとき', () => {
    it('後から届いた変更は失敗する', async () => {
      const d = deps()
      const payment = await registered(d)
      const seen = payment.version

      // 先に届いた変更が通る。
      await editPayment(d)({
        actor: taro.id,
        group: toGroupId('g1'),
        payment: payment.record.id,
        version: seen,
        payer: toMemberId('m1'),
        bearers: [toMemberId('m1')],
        amount: 3_000,
        currency: 'JPY',
        occurredOn: '2026-08-14',
        description: '先',
      })

      // 後から届いた側は、同じ版を見ていたため失敗する。
      const late = await editPayment(d)({
        actor: jiro.id,
        group: toGroupId('g1'),
        payment: payment.record.id,
        version: seen,
        payer: toMemberId('m1'),
        bearers: [toMemberId('m2')],
        amount: 9_000,
        currency: 'JPY',
        occurredOn: '2026-08-14',
        description: '後',
      })

      expect(late).toEqual({ ok: false, error: { kind: 'versionConflict' } })
    })

    it('先に加えられた変更が黙って上書きされることはない', async () => {
      const d = deps()
      const payment = await registered(d)
      const seen = payment.version

      await editPayment(d)({
        actor: taro.id,
        group: toGroupId('g1'),
        payment: payment.record.id,
        version: seen,
        payer: toMemberId('m1'),
        bearers: [toMemberId('m1')],
        amount: 3_000,
        currency: 'JPY',
        occurredOn: '2026-08-14',
        description: '先',
      })
      await editPayment(d)({
        actor: jiro.id,
        group: toGroupId('g1'),
        payment: payment.record.id,
        version: seen,
        payer: toMemberId('m1'),
        bearers: [toMemberId('m2')],
        amount: 9_000,
        currency: 'JPY',
        occurredOn: '2026-08-14',
        description: '後',
      })

      // **失敗した変更が、自動的にやり直されることもない。**
      expect(d.payments.stored()[0]?.record.money.amount).toBe(3_000)
      expect(d.payments.stored()[0]?.version).toBe(2)
    })
  })

  it('他のグループの記録を指した場合は、見つからないとして扱う', async () => {
    const d = deps()
    const payment = await registered(d)

    const result = await editPayment(d)({
      actor: hanako.id,
      group: toGroupId('g2'),
      payment: payment.record.id,
      version: payment.version,
      payer: toMemberId('m9'),
      bearers: [toMemberId('m9')],
      amount: 1_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: '',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notFound' } })
  })

  it('存在しない記録を指した場合も、見つからないとして扱う', async () => {
    const d = deps()

    const result = await editPayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payment: toPaymentId('いない'),
      version: 1,
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1')],
      amount: 1_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: '',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notFound' } })
  })

  it('内容が上限を超えていれば失敗し、記録は変わらない', async () => {
    const d = deps()
    const payment = await registered(d)

    const result = await editPayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1')],
      amount: 10_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: 'あ'.repeat(101),
    })

    expect(result).toEqual({ ok: false, error: { kind: 'descriptionTooLong' } })
    expect(d.payments.stored()[0]?.record.description).toBe('夕食')
  })
})

describe('支払いを削除する', () => {
  it('記録が完全に存在しなくなる', async () => {
    const d = deps()
    const payment = await registered(d)

    const result = await deletePayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
    })

    expect(result.ok).toBe(true)
    expect(d.payments.stored()).toHaveLength(0)
  })

  it('他の Member が登録した記録も削除できる', async () => {
    const d = deps()
    const payment = await registered(d)

    const result = await deletePayment(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
    })

    expect(result.ok).toBe(true)
  })

  it('古い版で削除しようとすると失敗し、記録は残る', async () => {
    const d = deps()
    const payment = await registered(d)

    await editPayment(d)({
      actor: taro.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1')],
      amount: 3_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      description: '先',
    })

    const result = await deletePayment(d)({
      actor: jiro.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
    })

    expect(result).toEqual({ ok: false, error: { kind: 'versionConflict' } })
    expect(d.payments.stored()).toHaveLength(1)
  })

  it('その Group の Member でなければ失敗し、記録は残る', async () => {
    const d = deps()
    const payment = await registered(d)

    const result = await deletePayment(d)({
      actor: hanako.id,
      group: toGroupId('g1'),
      payment: payment.record.id,
      version: payment.version,
    })

    expect(result).toEqual({ ok: false, error: { kind: 'notMember' } })
    expect(d.payments.stored()).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'
import { Group } from '../group/group'
import { User } from '../group/user'
import { toGroupId, toMemberId, toPaymentId, toUserId } from '../id'
import { DESCRIPTION_MAX_LENGTH, Payment } from './payment'

const userOf = (id: string, name: string) => {
  const user = User.create({ id: toUserId(id), name, loginIdentifier: `google:${id}` })
  if (!user.ok) throw new Error('前提の User を作れなかった')
  return user.value
}

const taro = userOf('u1', 'たろう')
const jiro = userOf('u2', 'じろう')
const saburo = userOf('u3', 'さぶろう')

const m1 = toMemberId('m1')
const m2 = toMemberId('m2')
const m3 = toMemberId('m3')
const outsider = toMemberId('m9')

const groupOf = () => {
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
  ].reduce((group, input) => {
    const joined = Group.join(group, input)
    if (!joined.ok) throw new Error('前提の参加に失敗した')
    return joined.value
  }, created.value)
}

const group = groupOf()

const recordedAt = new Date('2026-08-13T10:00:00.000Z')

const paymentOf = (overrides: Partial<Parameters<typeof Payment.create>[0]> = {}) =>
  Payment.create({
    id: toPaymentId('p1'),
    group,
    payer: m1,
    bearers: [m1, m2, m3],
    amount: 10000,
    currency: 'JPY',
    occurredOn: '2026-08-13',
    description: '夕食',
    recordedBy: taro.id,
    recordedAt,
    ...overrides,
  })

const created = (overrides: Partial<Parameters<typeof Payment.create>[0]> = {}) => {
  const payment = paymentOf(overrides)
  if (!payment.ok) throw new Error('前提の Payment を作れなかった')
  return payment.value
}

describe('Payment', () => {
  describe('支払いを記録する', () => {
    it('属性を持つ Payment ができる', () => {
      const payment = created()

      expect(payment.id).toBe(toPaymentId('p1'))
      expect(payment.groupId).toBe(toGroupId('g1'))
      expect(payment.payer).toBe(m1)
      expect(payment.bearers).toEqual([m1, m2, m3])
      expect(payment.money).toEqual({ amount: 10000, currency: 'JPY' })
      expect(payment.occurredOn).toBe('2026-08-13')
      expect(payment.description).toBe('夕食')
      expect(payment.recordedBy).toBe(taro.id)
      expect(payment.recordedAt).toBe(recordedAt)
    })

    it('1 件の記録は 1 つの通貨だけを持つ', () => {
      expect(Object.keys(created().money)).toEqual(['amount', 'currency'])
    })

    it('ID と登録日時は受け取るだけで、ここでは作らない', () => {
      const payment = created({ id: toPaymentId('p2'), recordedAt: new Date(0) })

      expect(payment.id).toBe(toPaymentId('p2'))
      expect(payment.recordedAt.getTime()).toBe(0)
    })
  })

  describe('支払者と負担者', () => {
    it('支払者が負担者に含まれてもよい', () => {
      expect(paymentOf({ payer: m1, bearers: [m1, m2] }).ok).toBe(true)
    })

    it('支払者が負担者に含まれなくてもよい', () => {
      expect(paymentOf({ payer: m1, bearers: [m2, m3] }).ok).toBe(true)
    })

    it('負担者が 1 人だけでもよい', () => {
      expect(paymentOf({ payer: m1, bearers: [m2] }).ok).toBe(true)
    })

    it('負担者が空なら失敗する', () => {
      expect(paymentOf({ bearers: [] })).toEqual({
        ok: false,
        error: { kind: 'bearersEmpty' },
      })
    })

    it('同じ Member を重複して負担者に含められない', () => {
      expect(paymentOf({ bearers: [m1, m2, m1] })).toEqual({
        ok: false,
        error: { kind: 'bearerDuplicated' },
      })
    })

    it('そのグループの Member でない支払者を受け付けない', () => {
      expect(paymentOf({ payer: outsider })).toEqual({
        ok: false,
        error: { kind: 'payerNotMember' },
      })
    })

    it('そのグループの Member でない負担者を受け付けない', () => {
      expect(paymentOf({ bearers: [m1, outsider] })).toEqual({
        ok: false,
        error: { kind: 'bearerNotMember' },
      })
    })

    it('負担者は集合として持つため、入力の順番は残らない', () => {
      expect(created({ bearers: [m3, m1, m2] }).bearers).toEqual(created().bearers)
    })
  })

  describe('金額と通貨', () => {
    it('金額の制約は金額の側と同じ', () => {
      expect(paymentOf({ amount: 0 })).toEqual({
        ok: false,
        error: { kind: 'amountNotPositiveInteger' },
      })
      expect(paymentOf({ amount: 1_000_000_001 })).toEqual({
        ok: false,
        error: { kind: 'amountTooLarge' },
      })
    })

    it('表に無い通貨コードを受け付けない', () => {
      expect(paymentOf({ currency: 'ZZZ' })).toEqual({
        ok: false,
        error: { kind: 'currencyUnsupported' },
      })
    })
  })

  describe('発生日', () => {
    it('未来の日付を許す', () => {
      expect(paymentOf({ occurredOn: '2999-12-31' }).ok).toBe(true)
    })

    it('日付として解釈できないものを受け付けない', () => {
      expect(paymentOf({ occurredOn: '2026-02-30' })).toEqual({
        ok: false,
        error: { kind: 'dateInvalid' },
      })
    })
  })

  describe('内容', () => {
    it('空でもよい', () => {
      expect(created({ description: '' }).description).toBe('')
      expect(created({ description: '   ' }).description).toBe('')
    })

    it('前後の空白は落とす', () => {
      expect(created({ description: '  夕食  ' }).description).toBe('夕食')
    })

    it('100 文字以内', () => {
      expect(DESCRIPTION_MAX_LENGTH).toBe(100)
      expect(paymentOf({ description: 'あ'.repeat(100) }).ok).toBe(true)
      expect(paymentOf({ description: 'あ'.repeat(101) })).toEqual({
        ok: false,
        error: { kind: 'descriptionTooLong' },
      })
    })

    it('2 つの符号単位で表される文字も 1 文字として数える', () => {
      expect(paymentOf({ description: '🐧'.repeat(100) }).ok).toBe(true)
      expect(paymentOf({ description: '🐧'.repeat(101) }).ok).toBe(false)
    })
  })

  describe('負担額の配分', () => {
    it('金額と負担者から導出する', () => {
      expect(Payment.shares(created({ amount: 10000, bearers: [m1, m2, m3] }))).toEqual([
        { bearer: m1, amount: 3334 },
        { bearer: m2, amount: 3333 },
        { bearer: m3, amount: 3333 },
      ])
    })

    it('支払者であることを理由に端数を優先して割り当てない', () => {
      // 支払者を変えても配分は変わらない（見るのは配分順序だけ）。
      expect(Payment.shares(created({ payer: m3 }))).toEqual(Payment.shares(created({ payer: m1 })))
    })

    it('同じ Payment からは常に同じ配分になる', () => {
      const payment = created()

      expect(Payment.shares(payment)).toEqual(Payment.shares(payment))
    })
  })

  describe('編集', () => {
    const edited = (actor: typeof taro.id | undefined = taro.id) =>
      Payment.edit(created(), {
        group,
        actor,
        payer: m2,
        bearers: [m2, m3],
        amount: 5000,
        currency: 'USD',
        occurredOn: '2026-08-14',
        description: '昼食',
      })

    it('編集後の内容が現在の記録になる', () => {
      const payment = edited()

      expect(payment.ok && payment.value.payer).toBe(m2)
      expect(payment.ok && payment.value.bearers).toEqual([m2, m3])
      expect(payment.ok && payment.value.money).toEqual({ amount: 5000, currency: 'USD' })
      expect(payment.ok && payment.value.occurredOn).toBe('2026-08-14')
      expect(payment.ok && payment.value.description).toBe('昼食')
    })

    it('登録日時を取り直さない', () => {
      const payment = edited()

      expect(payment.ok && payment.value.recordedAt).toBe(recordedAt)
    })

    it('ID・グループ・登録者は変わらない', () => {
      const payment = edited()

      expect(payment.ok && payment.value.id).toBe(toPaymentId('p1'))
      expect(payment.ok && payment.value.groupId).toBe(toGroupId('g1'))
      expect(payment.ok && payment.value.recordedBy).toBe(taro.id)
    })

    it('他の Member が登録した記録も編集できる', () => {
      // 登録者は権限の判定に使わない（`docs/domain/record.md`「登録者」）。
      expect(edited(jiro.id).ok).toBe(true)
    })

    it('Member でなければ失敗する', () => {
      const stranger = userOf('u9', 'よそもの')

      expect(edited(stranger.id)).toEqual({ ok: false, error: { kind: 'notMember' } })
    })

    it('ログインしていなければ失敗する', () => {
      const payment = Payment.edit(created(), {
        group,
        actor: undefined,
        payer: m2,
        bearers: [m2, m3],
        amount: 5000,
        currency: 'USD',
        occurredOn: '2026-08-14',
        description: '昼食',
      })

      expect(payment).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    })

    it('属性の制約は記録するときと同じ', () => {
      expect(
        Payment.edit(created(), {
          group,
          actor: taro.id,
          payer: m1,
          bearers: [],
          amount: 5000,
          currency: 'JPY',
          occurredOn: '2026-08-14',
          description: '',
        }),
      ).toEqual({ ok: false, error: { kind: 'bearersEmpty' } })
    })

    it('編集前の内容は残らない', () => {
      const payment = edited()

      expect(payment.ok && JSON.stringify(payment.value)).not.toContain('夕食')
    })
  })

  describe('起きないこと', () => {
    it('操作しても元の Payment は書き換わらない', () => {
      const payment = created()

      Payment.edit(payment, {
        group,
        actor: taro.id,
        payer: m2,
        bearers: [m2],
        amount: 1,
        currency: 'USD',
        occurredOn: '2026-01-01',
        description: '昼食',
      })
      Payment.shares(payment)

      expect(payment).toEqual(created())
    })

    it('失敗したとき、記録は作られない', () => {
      expect(paymentOf({ bearers: [] }).ok).toBe(false)
    })
  })
})

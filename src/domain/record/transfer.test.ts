import { describe, expect, it } from 'vitest'
import { Group } from '../group/group'
import { User } from '../group/user'
import { toGroupId, toMemberId, toTransferId, toUserId } from '../id'
import { Transfer } from './transfer'

const userOf = (id: string, name: string) => {
  const user = User.create({ id: toUserId(id), name, loginIdentifier: `google:${id}` })
  if (!user.ok) throw new Error('前提の User を作れなかった')
  return user.value
}

const taro = userOf('u1', 'たろう')
const jiro = userOf('u2', 'じろう')

const m1 = toMemberId('m1')
const m2 = toMemberId('m2')
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

  const joined = Group.join(created.value, {
    memberId: m2,
    user: jiro,
    displayName: 'じろう',
  })
  if (!joined.ok) throw new Error('前提の参加に失敗した')

  return joined.value
}

const group = groupOf()

const recordedAt = new Date('2026-08-13T10:00:00.000Z')

const transferOf = (overrides: Partial<Parameters<typeof Transfer.create>[0]> = {}) =>
  Transfer.create({
    id: toTransferId('t1'),
    group,
    sender: m1,
    recipient: m2,
    amount: 2000,
    currency: 'JPY',
    occurredOn: '2026-08-13',
    recordedBy: taro.id,
    recordedAt,
    ...overrides,
  })

const created = (overrides: Partial<Parameters<typeof Transfer.create>[0]> = {}) => {
  const transfer = transferOf(overrides)
  if (!transfer.ok) throw new Error('前提の Transfer を作れなかった')
  return transfer.value
}

describe('Transfer', () => {
  describe('送金を記録する', () => {
    it('属性を持つ Transfer ができる', () => {
      const transfer = created()

      expect(transfer.id).toBe(toTransferId('t1'))
      expect(transfer.groupId).toBe(toGroupId('g1'))
      expect(transfer.sender).toBe(m1)
      expect(transfer.recipient).toBe(m2)
      expect(transfer.money).toEqual({ amount: 2000, currency: 'JPY' })
      expect(transfer.occurredOn).toBe('2026-08-13')
      expect(transfer.recordedBy).toBe(taro.id)
      expect(transfer.recordedAt).toBe(recordedAt)
    })

    it('内容を持たない', () => {
      // 送金そのものだけを記録し、「なぜ送ったか」を残さない（`docs/domain/record.md`）。
      expect(created()).not.toHaveProperty('description')
    })

    it('1 件の記録は 1 つの通貨だけを持つ', () => {
      expect(Object.keys(created().money)).toEqual(['amount', 'currency'])
    })
  })

  describe('ルール', () => {
    it('送り手と受け手が同じなら失敗する', () => {
      expect(transferOf({ sender: m1, recipient: m1 })).toEqual({
        ok: false,
        error: { kind: 'sameSenderAndRecipient' },
      })
    })

    it('グループ外への送金は扱わない', () => {
      expect(transferOf({ recipient: outsider })).toEqual({
        ok: false,
        error: { kind: 'recipientNotMember' },
      })
      expect(transferOf({ sender: outsider })).toEqual({
        ok: false,
        error: { kind: 'senderNotMember' },
      })
    })

    it('金額と通貨の制約は金額の側と同じ', () => {
      expect(transferOf({ amount: 0 })).toEqual({
        ok: false,
        error: { kind: 'amountNotPositiveInteger' },
      })
      expect(transferOf({ currency: 'ZZZ' })).toEqual({
        ok: false,
        error: { kind: 'currencyUnsupported' },
      })
    })

    it('未来の発生日を許す', () => {
      expect(transferOf({ occurredOn: '2999-12-31' }).ok).toBe(true)
    })

    it('特定の Payment との紐付けを持たない', () => {
      expect(Object.keys(created())).toEqual([
        'id',
        'groupId',
        'sender',
        'recipient',
        'money',
        'occurredOn',
        'recordedBy',
        'recordedAt',
      ])
    })
  })

  describe('編集', () => {
    const edited = (actor = taro.id) =>
      Transfer.edit(created(), {
        group,
        actor,
        sender: m2,
        recipient: m1,
        amount: 3000,
        currency: 'USD',
        occurredOn: '2026-08-14',
      })

    it('編集後の内容が現在の記録になる', () => {
      const transfer = edited()

      expect(transfer.ok && transfer.value.sender).toBe(m2)
      expect(transfer.ok && transfer.value.recipient).toBe(m1)
      expect(transfer.ok && transfer.value.money).toEqual({ amount: 3000, currency: 'USD' })
      expect(transfer.ok && transfer.value.occurredOn).toBe('2026-08-14')
    })

    it('登録日時を取り直さない', () => {
      const transfer = edited()

      expect(transfer.ok && transfer.value.recordedAt).toBe(recordedAt)
    })

    it('ID・グループ・登録者は変わらない', () => {
      const transfer = edited()

      expect(transfer.ok && transfer.value.id).toBe(toTransferId('t1'))
      expect(transfer.ok && transfer.value.groupId).toBe(toGroupId('g1'))
      expect(transfer.ok && transfer.value.recordedBy).toBe(taro.id)
    })

    it('他の Member が登録した記録も編集できる', () => {
      expect(edited(jiro.id).ok).toBe(true)
    })

    it('Member でなければ失敗する', () => {
      expect(edited(userOf('u9', 'よそもの').id)).toEqual({
        ok: false,
        error: { kind: 'notMember' },
      })
    })

    it('過去の Transfer との整合性を検査しない', () => {
      // 収支がマイナスになるような編集でも、それを理由に失敗させない。
      expect(
        Transfer.edit(created(), {
          group,
          actor: taro.id,
          sender: m1,
          recipient: m2,
          amount: 1_000_000_000,
          currency: 'JPY',
          occurredOn: '2026-08-13',
        }).ok,
      ).toBe(true)
    })
  })

  describe('起きないこと', () => {
    it('操作しても元の Transfer は書き換わらない', () => {
      const transfer = created()

      Transfer.edit(transfer, {
        group,
        actor: taro.id,
        sender: m2,
        recipient: m1,
        amount: 1,
        currency: 'USD',
        occurredOn: '2026-01-01',
      })

      expect(transfer).toEqual(created())
    })
  })
})

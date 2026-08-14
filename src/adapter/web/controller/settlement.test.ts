import { describe, expect, it, vi } from 'vitest'
import { toGroupId, toMemberId, toTransferId } from '../../../domain/id'
import { Transfer } from '../../../domain/record/transfer'
import { err, ok } from '../../../domain/result'
import { groupOf, jiro, taro } from '../../../usecase/fixture'
import { initialSettlementTransferView } from '../presenter/settlement'
import { registerSettlementTransfer } from './settlement'

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

/** 登録されたときに返る Transfer。**金額は導出し直されたもの。** */
const registered = (() => {
  const result = Transfer.create({
    id: toTransferId('t1'),
    group,
    sender: toMemberId('m2'),
    recipient: toMemberId('m1'),
    amount: 4_200,
    currency: 'JPY',
    occurredOn: '2026-08-14',
    recordedBy: jiro.id,
    recordedAt: new Date('2026-08-14T00:00:00.000Z'),
  })
  if (!result.ok) throw new Error('前提の Transfer を作れなかった')
  return { record: result.value, version: 1 }
})()

const form = (entries: Record<string, string>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(entries)) data.append(name, value)
  return data
}

const submitted = form({
  groupId: 'g1',
  sender: 'm2',
  recipient: 'm1',
  currency: 'JPY',
  occurredOn: '2026-08-14',
  // 画面に出ていた額。**受け取らないことをここで確かめる。**
  amount: '5000',
})

describe('清算案の送金を記録する', () => {
  it('誰から誰へ・どの通貨か・発生日だけを渡す。金額は渡さない', async () => {
    const usecase = vi.fn(async () => ok(registered))

    await registerSettlementTransfer({
      registerSettlementTransfer: usecase as never,
      actor: taro.id,
    })(initialSettlementTransferView(), submitted)

    expect(usecase).toHaveBeenCalledWith({
      actor: taro.id,
      group: toGroupId('g1'),
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      currency: 'JPY',
      occurredOn: '2026-08-14',
    })
  })

  it('発生日は入力から受け取る（サーバーの時計を使わない）', async () => {
    const usecase = vi.fn(async () => ok(registered))

    await registerSettlementTransfer({
      registerSettlementTransfer: usecase as never,
      actor: taro.id,
    })(
      initialSettlementTransferView(),
      form({ groupId: 'g1', sender: 'm2', recipient: 'm1', currency: 'JPY', occurredOn: '2026-01-02' }),
    )

    expect(usecase).toHaveBeenCalledWith(expect.objectContaining({ occurredOn: '2026-01-02' }))
  })

  it('記録された額を伝える。画面に出ていた額ではない', async () => {
    const view = await registerSettlementTransfer({
      registerSettlementTransfer: (async () => ok(registered)) as never,
      actor: taro.id,
    })(initialSettlementTransferView(), submitted)

    expect(view.kind).toBe('registered')
    // 送ったのは 5,000 と書かれた行だが、記録されたのは導出し直された 4,200。
    expect(view.kind === 'registered' && view.message).toContain('4,200')
  })

  it('清算案が変わっていたら、そのタグが戻る', async () => {
    const view = await registerSettlementTransfer({
      registerSettlementTransfer: async () => err({ kind: 'settlementChanged' as const }),
      actor: taro.id,
    })(initialSettlementTransferView(), submitted)

    expect(view.kind).toBe('changed')
    expect(view.kind === 'changed' && view.reloadHref).toBe('/groups/g1/settlement')
  })
})

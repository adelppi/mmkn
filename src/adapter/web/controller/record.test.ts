import { describe, expect, it, vi } from 'vitest'
import { toGroupId, toMemberId, toPaymentId, toTransferId } from '../../../domain/id'
import { err, ok } from '../../../domain/result'
import { groupOf, jiro, taro } from '../../../usecase/fixture'
import { initialRecordFormView, recordFormFields } from '../presenter/record'
import { deleteRecord, saveRecord, type RecordUseCases } from './record'

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

const form = (entries: Record<string, string | readonly string[]>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    for (const one of Array.isArray(value) ? value : [value as string]) data.append(name, one)
  }
  return data
}

const stubs = (): RecordUseCases => ({
  registerPayment: vi.fn(async () => ok({ record: {}, version: 1 })) as never,
  editPayment: vi.fn(async () => ok({ record: {}, version: 2 })) as never,
  deletePayment: vi.fn(async () => ok(undefined)) as never,
  registerTransfer: vi.fn(async () => ok({ record: {}, version: 1 })) as never,
  editTransfer: vi.fn(async () => ok({ record: {}, version: 2 })) as never,
  deleteTransfer: vi.fn(async () => ok(undefined)) as never,
})

const newPaymentForm = () =>
  initialRecordFormView(recordFormFields(group, [], { type: 'payment' }))

describe('支払いを記録する', () => {
  it('打たれた内容を、最小単位の整数に直して渡す', async () => {
    const deps = { ...stubs(), actor: taro.id }

    await saveRecord(deps)(
      newPaymentForm(),
      form({
        type: 'payment',
        amount: '48,000',
        currency: 'JPY',
        payer: 'm1',
        bearers: ['m1', 'm2'],
        occurredOn: '2026-08-08',
        description: 'ホテル 2泊',
      }),
    )

    expect(deps.registerPayment).toHaveBeenCalledWith({
      actor: taro.id,
      group: toGroupId('g1'),
      amount: 48_000,
      currency: 'JPY',
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1'), toMemberId('m2')],
      occurredOn: '2026-08-08',
      description: 'ホテル 2泊',
    })
  })

  it('最小単位が 2 桁の通貨は、小数を最小単位に直す', async () => {
    const deps = { ...stubs(), actor: taro.id }

    await saveRecord(deps)(
      newPaymentForm(),
      form({
        type: 'payment',
        amount: '10.50',
        currency: 'USD',
        payer: 'm1',
        bearers: ['m1'],
        occurredOn: '2026-08-08',
        description: '',
      }),
    )

    expect(deps.registerPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1050, currency: 'USD' }),
    )
  })

  it('読めない金額を 0 で埋めない。判定はドメイン層に任せる', async () => {
    const deps = { ...stubs(), actor: taro.id }

    await saveRecord(deps)(
      newPaymentForm(),
      form({ type: 'payment', amount: '', currency: 'JPY', payer: 'm1', bearers: ['m1'] }),
    )

    const [input] = (deps.registerPayment as unknown as { mock: { calls: [{ amount: number }][] } })
      .mock.calls[0] ?? []
    expect(Number.isNaN(input?.amount)).toBe(true)
  })

  it('扱えない通貨も、ここでは弾かずにそのまま渡す', async () => {
    const deps = { ...stubs(), actor: taro.id }

    await saveRecord(deps)(
      newPaymentForm(),
      form({ type: 'payment', amount: '100', currency: 'XXX', payer: 'm1', bearers: ['m1'] }),
    )

    expect(deps.registerPayment).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'XXX' }),
    )
  })

  it('負担者を 1 人も選ばなくても、そのまま渡す（判定はドメイン層）', async () => {
    const deps = { ...stubs(), actor: taro.id }

    await saveRecord(deps)(
      newPaymentForm(),
      form({ type: 'payment', amount: '100', currency: 'JPY', payer: 'm1' }),
    )

    expect(deps.registerPayment).toHaveBeenCalledWith(expect.objectContaining({ bearers: [] }))
  })

  it('失敗したら、打った内容がフォームに戻る', async () => {
    const deps = {
      ...stubs(),
      registerPayment: async () => err({ kind: 'bearersEmpty' as const }),
      actor: taro.id,
    }

    const view = await saveRecord(deps as never)(
      newPaymentForm(),
      form({ type: 'payment', amount: '48000', currency: 'JPY', payer: 'm1' }),
    )

    expect(view.kind).toBe('invalid')
    expect(view.kind === 'invalid' && view.form.amount).toBe('48000')
    expect(view.kind === 'invalid' && view.form.payer).toBe('m1')
  })
})

describe('支払いを編集する', () => {
  it('記録の識別子があれば編集になり、見ていた版を渡す', async () => {
    const deps = { ...stubs(), actor: taro.id }
    const previous = initialRecordFormView(
      recordFormFields(group, [], { type: 'payment', recordId: 'p1', version: 3 }),
    )

    await saveRecord(deps)(
      previous,
      form({
        type: 'payment',
        amount: '48000',
        currency: 'JPY',
        payer: 'm1',
        bearers: ['m1'],
        occurredOn: '2026-08-08',
        description: '',
      }),
    )

    expect(deps.registerPayment).not.toHaveBeenCalled()
    expect(deps.editPayment).toHaveBeenCalledWith(
      expect.objectContaining({ payment: toPaymentId('p1'), version: 3 }),
    )
  })

  it('版が変わっていたら、読み込み直す導線が出る', async () => {
    const deps = {
      ...stubs(),
      editPayment: async () => err({ kind: 'versionConflict' as const }),
      actor: taro.id,
    }
    const previous = initialRecordFormView(
      recordFormFields(group, [], { type: 'payment', recordId: 'p1', version: 3 }),
    )

    const view = await saveRecord(deps as never)(previous, form({ type: 'payment', amount: '1' }))

    expect(view.kind).toBe('conflict')
  })
})

describe('送金を記録する', () => {
  it('送り手と受け手を渡す。内容は送らない', async () => {
    const deps = { ...stubs(), actor: taro.id }
    const previous = initialRecordFormView(recordFormFields(group, [], { type: 'transfer' }))

    await saveRecord(deps)(
      previous,
      form({
        type: 'transfer',
        amount: '12000',
        currency: 'JPY',
        sender: 'm2',
        recipient: 'm1',
        occurredOn: '2026-08-08',
      }),
    )

    expect(deps.registerTransfer).toHaveBeenCalledWith({
      actor: taro.id,
      group: toGroupId('g1'),
      amount: 12_000,
      currency: 'JPY',
      sender: toMemberId('m2'),
      recipient: toMemberId('m1'),
      occurredOn: '2026-08-08',
    })
  })

  it('編集では送金のユースケースが呼ばれる', async () => {
    const deps = { ...stubs(), actor: taro.id }
    const previous = initialRecordFormView(
      recordFormFields(group, [], { type: 'transfer', recordId: 't1', version: 2 }),
    )

    await saveRecord(deps)(previous, form({ type: 'transfer', amount: '1', currency: 'JPY' }))

    expect(deps.editTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ transfer: toTransferId('t1'), version: 2 }),
    )
  })
})

describe('記録を削除する', () => {
  it('種類に応じたユースケースを、見ていた版で呼ぶ', async () => {
    const deps = { ...stubs(), actor: taro.id }
    const previous = initialRecordFormView(
      recordFormFields(group, [], { type: 'payment', recordId: 'p1', version: 4 }),
    )

    await deleteRecord(deps)(previous, form({ type: 'payment' }))

    expect(deps.deletePayment).toHaveBeenCalledWith({
      actor: taro.id,
      group: toGroupId('g1'),
      payment: toPaymentId('p1'),
      version: 4,
    })
  })

  it('送金の削除も同じ形', async () => {
    const deps = { ...stubs(), actor: taro.id }
    const previous = initialRecordFormView(
      recordFormFields(group, [], { type: 'transfer', recordId: 't1', version: 1 }),
    )

    await deleteRecord(deps)(previous, form({ type: 'transfer' }))

    expect(deps.deleteTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ transfer: toTransferId('t1') }),
    )
  })
})

/**
 * 済んだことは行き先に載る（`src/adapter/web/presenter/notice.ts`）。
 *
 * **保存できると画面は記録一覧へ移る。** 何が済んだかはそこまで運ぶ必要があるため、
 * 操作の違いは行き先に現れる。
 */
describe('済んだことの伝わり方', () => {
  const redirectOf = (view: { kind: string }) =>
    'redirectTo' in view ? (view as { redirectTo: string }).redirectTo : undefined

  it('支払いの登録と送金の登録で、伝わることが違う', async () => {
    const deps = { ...stubs(), actor: taro.id }
    const base = form({ type: 'payment', amount: '1000', currency: 'JPY', payer: 'm1' })

    const payment = await saveRecord(deps)(newPaymentForm(), base)
    const transfer = await saveRecord(deps)(
      newPaymentForm(),
      form({ type: 'transfer', amount: '1000', currency: 'JPY', sender: 'm1', recipient: 'm2' }),
    )

    expect(redirectOf(payment)).toBe('/groups/g1?notice=paymentRecorded')
    expect(redirectOf(transfer)).toBe('/groups/g1?notice=transferRecorded')
  })

  it('編集は、登録とは別のことが伝わる', async () => {
    const deps = { ...stubs(), actor: taro.id }
    const editing = initialRecordFormView(
      recordFormFields(group, [], { type: 'payment', recordId: 'p1', version: 1 }),
    )

    const view = await saveRecord(deps)(
      editing,
      form({
        type: 'payment',
        amount: '1000',
        currency: 'JPY',
        payer: 'm1',
        bearers: ['m1'],
        occurredOn: '2026-08-08',
      }),
    )

    expect(redirectOf(view)).toBe('/groups/g1?notice=recordSaved')
  })

  it('削除は削除として伝わる', async () => {
    const deps = { ...stubs(), actor: taro.id }
    const editing = initialRecordFormView(
      recordFormFields(group, [], { type: 'payment', recordId: 'p1', version: 1 }),
    )

    const view = await deleteRecord(deps)(
      editing,
      form({ type: 'payment', groupId: 'g1', recordId: 'p1', version: '1' }),
    )

    expect(redirectOf(view)).toBe('/groups/g1?notice=recordDeleted')
  })
})

/**
 * どの記録への操作かの決まり方。
 *
 * **記録の詳細からの削除は、フォームの状態に識別子を持たない**（設計 08）。
 * 直前の状態から引き継げるのは選択肢だけで、対象は送られてきた入力にしか無い。
 */
describe('操作の対象', () => {
  it('直前の状態が識別子を持たなくても、送られてきた記録を削除する', async () => {
    const deps = { ...stubs(), actor: taro.id }

    await deleteRecord(deps)(
      newPaymentForm(),
      form({ type: 'payment', groupId: 'g1', recordId: 'p9', version: '4' }),
    )

    expect(deps.deletePayment).toHaveBeenCalledWith({
      actor: taro.id,
      group: toGroupId('g1'),
      payment: toPaymentId('p9'),
      version: 4,
    })
  })

  it('送金も同じ経路で削除できる', async () => {
    const deps = { ...stubs(), actor: taro.id }

    await deleteRecord(deps)(
      newPaymentForm(),
      form({ type: 'transfer', groupId: 'g1', recordId: 't9', version: '2' }),
    )

    expect(deps.deleteTransfer).toHaveBeenCalledWith({
      actor: taro.id,
      group: toGroupId('g1'),
      transfer: toTransferId('t9'),
      version: 2,
    })
  })

  it('識別子が送られてこない登録は、登録のままである', async () => {
    const deps = { ...stubs(), actor: taro.id }

    await saveRecord(deps)(
      newPaymentForm(),
      form({
        type: 'payment',
        groupId: 'g1',
        recordId: '',
        version: '',
        amount: '1000',
        currency: 'JPY',
        payer: 'm1',
        bearers: ['m1'],
        occurredOn: '2026-08-08',
      }),
    )

    expect(deps.registerPayment).toHaveBeenCalled()
    expect(deps.editPayment).not.toHaveBeenCalled()
  })
})

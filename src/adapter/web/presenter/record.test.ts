import { describe, expect, it } from 'vitest'
import { toMemberId, toPaymentId, toTransferId } from '../../../domain/id'
import { MONEY_MAX_AMOUNT } from '../../../domain/money/money'
import { DESCRIPTION_MAX_LENGTH, Payment } from '../../../domain/record/payment'
import type { AnyRecord } from '../../../domain/record/record'
import { Transfer } from '../../../domain/record/transfer'
import { err, ok } from '../../../domain/result'
import { groupOf, jiro, taro } from '../../../usecase/fixture'
import type { Versioned } from '../../../usecase/usecase'
import {
  recordFormFields,
  recordedCurrenciesOf,
  toRecordDetailView,
  toRecordFormView,
  toRecordListView,
} from './record'

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

const paymentOf = (input: {
  id: string
  amount?: number
  currency?: string
  occurredOn: string
  description?: string
}): Payment => {
  const result = Payment.create({
    id: toPaymentId(input.id),
    group,
    payer: toMemberId('m1'),
    bearers: [toMemberId('m1'), toMemberId('m2')],
    amount: input.amount ?? 48_000,
    currency: input.currency ?? 'JPY',
    occurredOn: input.occurredOn,
    description: input.description ?? 'ホテル 2泊',
    recordedBy: taro.id,
    recordedAt: new Date('2026-08-14T00:00:00.000Z'),
  })
  if (!result.ok) throw new Error('前提の Payment を作れなかった')
  return result.value
}

const transferOf = (id: string, occurredOn: string): Transfer => {
  const result = Transfer.create({
    id: toTransferId(id),
    group,
    sender: toMemberId('m2'),
    recipient: toMemberId('m1'),
    amount: 12_000,
    currency: 'JPY',
    occurredOn,
    recordedBy: jiro.id,
    recordedAt: new Date('2026-08-14T00:00:00.000Z'),
  })
  if (!result.ok) throw new Error('前提の Transfer を作れなかった')
  return result.value
}

const listed = (records: readonly AnyRecord[]) =>
  ok({
    group,
    records: records.map((record): Versioned<AnyRecord> => ({ record, version: 1 })),
  })

describe('記録一覧', () => {
  it('発生日ごとに束ねられる。並べ替えはしない', () => {
    const view = toRecordListView(
      listed([
        paymentOf({ id: 'p1', occurredOn: '2026-08-09', description: '夜市' }),
        paymentOf({ id: 'p2', occurredOn: '2026-08-08' }),
        transferOf('t1', '2026-08-08'),
      ]),
    )

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    expect(view.days.map((day) => day.label)).toEqual(['8月9日', '8月8日'])
    expect(view.days[1]?.rows).toHaveLength(2)
  })

  it('年が変わる記録には年が付く', () => {
    const view = toRecordListView(
      listed([
        paymentOf({ id: 'p1', occurredOn: '2026-08-09' }),
        paymentOf({ id: 'p2', occurredOn: '2025-12-31' }),
      ]),
    )

    expect(view.kind === 'ok' && view.days.map((day) => day.label)).toEqual([
      '8月9日',
      '2025年12月31日',
    ])
  })

  it('支払いは内容と「誰が支払い・何人分」が出る', () => {
    const view = toRecordListView(listed([paymentOf({ id: 'p1', occurredOn: '2026-08-08' })]))

    expect(view.kind === 'ok' && view.days[0]?.rows[0]).toMatchObject({
      type: 'payment',
      title: 'ホテル 2泊',
      detail: 'たろう が支払い ・ 2 人分',
      href: '/groups/g1/records/p1',
    })
  })

  it('内容が空の支払いにも、一覧に出す見出しが付く', () => {
    const view = toRecordListView(
      listed([paymentOf({ id: 'p1', occurredOn: '2026-08-08', description: '' })]),
    )

    expect(view.kind === 'ok' && view.days[0]?.rows[0]?.title).toBe('（内容なし）')
  })

  it('送金は「送り手 → 受け手」で出る', () => {
    const view = toRecordListView(listed([transferOf('t1', '2026-08-08')]))

    expect(view.kind === 'ok' && view.days[0]?.rows[0]).toMatchObject({
      type: 'transfer',
      title: 'じろう → たろう',
    })
  })

  it('1 件も無ければ空のタグになる', () => {
    const view = toRecordListView(listed([]))

    expect(view.kind).toBe('empty')
  })

  it('Member でなければ中身は返らない', () => {
    const view = toRecordListView(err({ kind: 'notMember' }))

    expect(view.kind).toBe('notMember')
  })
})

describe('記録の入力欄', () => {
  it('金額の上限はドメイン層の定数から来る（その通貨の表記で）', () => {
    const form = recordFormFields(group, [], { type: 'payment' })

    // JPY は最小単位が 0 桁なので、最小単位の数がそのまま表記になる。
    expect(form.amountLimits).toEqual({ max: String(MONEY_MAX_AMOUNT), step: '1', required: true })
  })

  it('最小単位が 2 桁の通貨では、上限も刻みもその桁で出る', () => {
    const form = recordFormFields(group, [], { type: 'payment', currency: 'USD' })

    expect(form.amountLimits.max).toBe(`${MONEY_MAX_AMOUNT / 100}.00`)
    expect(form.amountLimits.step).toBe('0.01')
  })

  it('内容の上限もドメイン層の定数から来る。空を許す', () => {
    const form = recordFormFields(group, [], { type: 'payment' })

    expect(form.descriptionLimits).toEqual({
      maxLength: DESCRIPTION_MAX_LENGTH,
      required: false,
    })
  })

  it('通貨の初期値はグループの既定通貨', () => {
    expect(recordFormFields(group, [], { type: 'payment' }).currency).toBe('JPY')
  })

  it('メンバーが選択肢として並ぶ', () => {
    expect(recordFormFields(group, [], { type: 'payment' }).members).toEqual([
      { id: 'm1', displayName: 'たろう' },
      { id: 'm2', displayName: 'じろう' },
    ])
  })
})

describe('記録に現れた通貨', () => {
  it('重複を取り除いて返る', () => {
    const records: Versioned<AnyRecord>[] = [
      { record: paymentOf({ id: 'p1', occurredOn: '2026-08-08' }), version: 1 },
      { record: paymentOf({ id: 'p2', occurredOn: '2026-08-08', currency: 'TWD' }), version: 1 },
      { record: transferOf('t1', '2026-08-08'), version: 1 },
    ]

    expect(recordedCurrenciesOf(records)).toEqual(['JPY', 'TWD'])
  })
})

describe('保存の結果', () => {
  const form = recordFormFields(group, [], { type: 'payment', recordId: 'p1', version: 3 })

  it('保存できたら、そのグループへ戻る', () => {
    const view = toRecordFormView(form, ok(undefined))

    expect(view.kind === 'saved' && view.redirectTo).toBe('/groups/g1')
  })

  it('入力の不備はフォームに戻る', () => {
    const view = toRecordFormView(form, err({ kind: 'bearersEmpty' }))

    expect(view.kind).toBe('invalid')
    expect(view.kind === 'invalid' && view.message).toBe('負担する人を 1 人以上選んでください。')
  })

  it('金額の上限超過も、フォームに戻る', () => {
    const view = toRecordFormView(form, err({ kind: 'amountTooLarge' }))

    expect(view.kind === 'invalid' && view.message).toContain('1 件の上限は')
  })

  it('同時に手が入っていたら、読み込み直す導線が出る', () => {
    const view = toRecordFormView(form, err({ kind: 'versionConflict' }))

    expect(view.kind).toBe('conflict')
    expect(view.kind === 'conflict' && view.reloadHref).toBe('/groups/g1/records/p1')
  })

  it('Member でなければ、フォームには戻らない', () => {
    const view = toRecordFormView(form, err({ kind: 'notMember' }))

    expect(view.kind).toBe('denied')
  })
})

describe('記録の詳細', () => {
  it('負担額が導出されて並ぶ', () => {
    const view = toRecordDetailView(
      'p1',
      listed([paymentOf({ id: 'p1', occurredOn: '2026-08-08', amount: 10_001 })]),
    )

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    // 端数は配分順序の先頭から 1 単位ずつ（`docs/domain/record.md`）。
    expect(view.shares.map((share) => share.money.digits)).toEqual(['5,001', '5,000'])
  })

  it('支払いには支払者が、送金には送り手と受け手が出る', () => {
    const payment = toRecordDetailView(
      'p1',
      listed([paymentOf({ id: 'p1', occurredOn: '2026-08-08' })]),
    )
    const transfer = toRecordDetailView('t1', listed([transferOf('t1', '2026-08-08')]))

    expect(payment.kind === 'ok' && payment.payerName).toBe('たろう')
    expect(transfer.kind === 'ok' && transfer.transferNames).toEqual({
      sender: 'じろう',
      recipient: 'たろう',
    })
  })

  it('登録した人が Member の表示名で出る', () => {
    const view = toRecordDetailView(
      'p1',
      listed([paymentOf({ id: 'p1', occurredOn: '2026-08-08' })]),
    )

    expect(view.kind === 'ok' && view.recordedBy).toBe('たろう')
  })

  it('編集用のフォームに、見ていた版が入る', () => {
    const view = toRecordDetailView(
      'p1',
      listed([paymentOf({ id: 'p1', occurredOn: '2026-08-08' })]),
    )

    expect(view.kind === 'ok' && view.form.version).toBe('1')
    expect(view.kind === 'ok' && view.form.submitLabel).toBe('保存する')
  })

  it('そのグループに無い記録は「見つからない」', () => {
    const view = toRecordDetailView('missing', listed([]))

    expect(view.kind).toBe('notFound')
  })
})

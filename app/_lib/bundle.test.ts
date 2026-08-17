import {
  bundledGroups,
  bundledPayments,
  bundledTransfers,
  noBundling,
  type BundleReads,
} from '@/app/_lib/bundle'
import { toGroupId, toMemberId } from '@/src/domain/id'
import { viewGroup } from '@/src/usecase/group/view-group'
import { groupOf, jiro, taro } from '@/src/usecase/fixture'
import {
  fakeClock,
  fakeGroupRepository,
  fakeIdGenerator,
  fakePaymentRepository,
  fakeTransferRepository,
} from '@/src/usecase/port/fake'
import { listRecords } from '@/src/usecase/record/list-records'
import { registerPayment } from '@/src/usecase/record/register-payment'
import { viewSettlement } from '@/src/usecase/settlement/view-settlement'
import { describe, expect, it, vi } from 'vitest'

/**
 * 取得を束ねる（`docs/adr/0009-web-ui.md`「束ねる位置」「束ねるのは読み取りだけの経路に限る」）。
 *
 * 確かめるのは 2 つ。
 *
 * - 読み取りだけの経路では、**別々のユースケースが同じものを読む重複が消える**
 * - 書き込みを伴う経路では**束ねない**。束ねると、同じ記録に同時に手が入ったことの検出が
 *   **失敗しないまま**成立しなくなる（`docs/domain/record.md`「同じ記録に同時に手が入ったとき」）
 */

/**
 * 束ねる合図の代わり。**本物は React の `cache()`**（`app/_lib/read.ts`）で 1 リクエストの中で
 * 閉じる。ここは 1 つのテストの中で閉じる。
 *
 * **結果ではなく、走り始めた取得そのものを覚える。** 記録・収支・清算案の Container は並んで走る
 * ため、結果を待ってから覚える形では束ならない。
 */
const bundling = (): BundleReads => {
  return <A extends unknown[], R>(read: (...args: A) => Promise<R>) => {
    const started = new Map<string, Promise<R>>()

    return (...args: A): Promise<R> => {
      const key = JSON.stringify(args)
      const running = started.get(key)
      if (running !== undefined) return running

      const promise = read(...args)
      started.set(key, promise)
      return promise
    }
  }
}

const GROUP = toGroupId('g1')

/** 記録のタブ 1 回ぶんの材料。**リポジトリの読み取りに印を付けてから束ねる。** */
const tab = (bundle: BundleReads) => {
  const groups = fakeGroupRepository([
    groupOf([
      { user: taro, memberId: 'm1' },
      { user: jiro, memberId: 'm2' },
    ]),
  ])
  const payments = fakePaymentRepository()
  const transfers = fakeTransferRepository()

  const reads = {
    group: vi.spyOn(groups, 'findById'),
    payments: vi.spyOn(payments, 'listByGroup'),
    transfers: vi.spyOn(transfers, 'listByGroup'),
  }

  const deps = {
    groups: bundledGroups(groups, bundle),
    payments: bundledPayments(payments, bundle),
    transfers: bundledTransfers(transfers, bundle),
    ids: fakeIdGenerator('r'),
    clock: fakeClock(new Date('2026-08-14T09:00:00.000Z')),
  }

  /** 3 つの Container が並んで走るのを再現する（`docs/adr/0009-web-ui.md`「Container の粒度」）。 */
  const draw = async () => {
    const input = { actor: taro.id, group: GROUP }

    await Promise.all([
      viewGroup(deps)(input),
      listRecords(deps)(input),
      viewSettlement(deps)(input),
    ])
  }

  return { deps, reads, draw }
}

describe('読み取りだけの経路で取得を束ねる', () => {
  it('記録のタブを 1 回描くと、グループも記録の全件も 1 回しか読まれない', async () => {
    const { reads, draw } = tab(bundling())

    await draw()

    expect(reads.group).toHaveBeenCalledTimes(1)
    expect(reads.payments).toHaveBeenCalledTimes(1)
    expect(reads.transfers).toHaveBeenCalledTimes(1)
  })

  it('束ねなければ、同じものが Container の数だけ読まれる', async () => {
    const { reads, draw } = tab(noBundling)

    await draw()

    // 上端・記録の一覧・収支がそれぞれグループを読む。記録の全件は一覧と収支が読む。
    expect(reads.group).toHaveBeenCalledTimes(3)
    expect(reads.payments).toHaveBeenCalledTimes(2)
    expect(reads.transfers).toHaveBeenCalledTimes(2)
  })

  it('引数が違えば別々に走る', async () => {
    const groups = fakeGroupRepository([
      groupOf([{ user: taro, memberId: 'm1' }]),
      groupOf([{ user: taro, memberId: 'm9' }], { id: 'g2', inviteCode: 'invite-2' }),
    ])
    const findById = vi.spyOn(groups, 'findById')
    const bundled = bundledGroups(groups, bundling())

    await Promise.all([bundled.findById(GROUP), bundled.findById(toGroupId('g2'))])

    expect(findById).toHaveBeenCalledTimes(2)
  })
})

describe('書き込みを伴う経路では束ねない', () => {
  /** 支払いを 1 件だけ登録し、その記録と版を返す。**登録は束ねない経路で行う。** */
  const registered = async () => {
    const payments = fakePaymentRepository()
    const deps = {
      groups: fakeGroupRepository([
        groupOf([
          { user: taro, memberId: 'm1' },
          { user: jiro, memberId: 'm2' },
        ]),
      ]),
      payments,
      ids: fakeIdGenerator('r'),
      clock: fakeClock(new Date('2026-08-14T09:00:00.000Z')),
    }

    const result = await registerPayment(deps)({
      actor: taro.id,
      group: GROUP,
      payer: toMemberId('m1'),
      bearers: [toMemberId('m1'), toMemberId('m2')],
      amount: 1_000,
      currency: 'JPY',
      occurredOn: '2026-08-10',
      description: 'ランチ',
    })
    if (!result.ok) throw new Error('前提の支払いを登録できなかった')

    const [stored] = payments.stored()
    if (stored === undefined) throw new Error('前提の支払いが保存されていない')

    return { payments, stored }
  }

  it('既定では束ねない', async () => {
    const { payments, stored } = await registered()
    const find = vi.spyOn(payments, 'find')
    const bundled = bundledPayments(payments, noBundling)

    await bundled.find(stored.record.id)
    await bundled.find(stored.record.id)

    expect(find).toHaveBeenCalledTimes(2)
  })

  it('束ねない経路では、書き込みのあとの読み直しが新しい版を返す', async () => {
    const { payments, stored } = await registered()
    const bundled = bundledPayments(payments, noBundling)

    const seen = await bundled.find(stored.record.id)
    // 他の人が先に同じ記録を変えた。
    await payments.update(stored.record, stored.version)
    const again = await bundled.find(stored.record.id)

    expect(seen?.version).toBe(stored.version)
    expect(again?.version).not.toBe(stored.version)
  })

  it('束ねると読み直しが古い版を返し、検出が失敗しないまま成立しなくなる', async () => {
    const { payments, stored } = await registered()
    const bundled = bundledPayments(payments, bundling())

    await bundled.find(stored.record.id)
    await payments.update(stored.record, stored.version)
    const again = await bundled.find(stored.record.id)

    // **これが、書き込みを伴う経路で束ねてはいけない理由である。**
    // 読み直しが古い版のままなので、古い版での更新が「通ってしまう」形にはならず、
    // 「変わったこと自体が見えない」形で壊れる。失敗しないため表に出ない。
    expect(again?.version).toBe(stored.version)
  })

  it('書き込みそのものは包まれない', async () => {
    const { payments, stored } = await registered()
    const update = vi.spyOn(payments, 'update')
    const bundled = bundledPayments(payments, bundling())

    const first = await bundled.update(stored.record, stored.version)
    const second = await bundled.update(stored.record, stored.version)

    expect(update).toHaveBeenCalledTimes(2)
    expect(first.kind).toBe('written')
    // 2 回目は版が変わっているため通らない（`docs/domain/record.md`）。
    expect(second.kind).toBe('stale')
  })
})

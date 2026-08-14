import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId } from '../../domain/id'
import { groupOf, hanako, jiro, taro } from '../fixture'
import {
  fakeClock,
  fakeGroupRepository,
  fakeIdGenerator,
  fakePaymentRepository,
  fakeTransferRepository,
  fakeUserRepository,
} from '../port/fake'
import { registerPayment } from '../record/register-payment'
import { listGroups } from './list-groups'

/** たろうとじろうの「沖縄旅行」と、じろうとはなこの「台湾旅行」。 */
const okinawa = groupOf(
  [
    { user: taro, memberId: 'm1' },
    { user: jiro, memberId: 'm2' },
  ],
  { id: 'g1', name: '沖縄旅行', inviteCode: 'invite-1' },
)

const taiwan = groupOf(
  [
    { user: jiro, memberId: 'm3' },
    { user: hanako, memberId: 'm4' },
  ],
  { id: 'g2', name: '台湾旅行', inviteCode: 'invite-2' },
)

const deps = () => ({
  groups: fakeGroupRepository([okinawa, taiwan]),
  users: fakeUserRepository([taro, jiro, hanako]),
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

describe('自分が Member であるグループを一覧する', () => {
  it('自分が Member のグループだけが返る', async () => {
    const result = await listGroups(deps())({ actor: taro.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.groups.map((summary) => summary.group.name)).toEqual(['沖縄旅行'])
  })

  it('複数のグループは名前の昇順で並ぶ', async () => {
    const result = await listGroups(deps())({ actor: jiro.id })

    expect(result.ok && result.value.groups.map((summary) => summary.group.name)).toEqual([
      '台湾旅行',
      '沖縄旅行',
    ])
  })

  it('自分の収支が通貨ごとに返る', async () => {
    const result = await listGroups(await withPayment(deps()))({ actor: taro.id })

    expect(result.ok && result.value.groups[0]?.balances).toEqual([
      { currency: 'JPY', amount: 5_000 },
    ])
  })

  it('他の Member の収支は返らない', async () => {
    const result = await listGroups(await withPayment(deps()))({ actor: jiro.id })

    const okinawaSummary = result.ok
      ? result.value.groups.find((summary) => summary.group.name === '沖縄旅行')
      : undefined

    // じろう自身の分（−5,000）だけ。たろうの +5,000 は現れない。
    expect(okinawaSummary?.balances).toEqual([{ currency: 'JPY', amount: -5_000 }])
  })

  it('記録が無ければ収支は空になる', async () => {
    const result = await listGroups(deps())({ actor: taro.id })

    expect(result.ok && result.value.groups[0]?.balances).toEqual([])
  })

  it('ログインしていなければ失敗する', async () => {
    const result = await listGroups(deps())({ actor: undefined })

    expect(result.ok === false && result.error.kind).toBe('notAuthenticated')
  })

  it('どのグループにも入っていなければ空になる', async () => {
    const d = deps()
    d.groups = fakeGroupRepository([])

    const result = await listGroups(d)({ actor: taro.id })

    expect(result.ok && result.value.groups).toEqual([])
  })
})

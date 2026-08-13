import { describe, expect, it } from 'vitest'
import { Group } from '../group/group'
import { User } from '../group/user'
import { toGroupId, toMemberId, toPaymentId, toUserId } from '../id'
import { requireRecordMember } from './access'

const userOf = (id: string, name: string) => {
  const user = User.create({ id: toUserId(id), name, loginIdentifier: `google:${id}` })
  if (!user.ok) throw new Error('前提の User を作れなかった')
  return user.value
}

const taro = userOf('u1', 'たろう')
const jiro = userOf('u2', 'じろう')

const groupOf = (id: string, inviteCode: string) => {
  const created = Group.create({
    id: toGroupId(id),
    name: '沖縄旅行',
    defaultCurrency: 'JPY',
    inviteCode,
    creator: taro,
    creatorMemberId: toMemberId(`${id}-m1`),
  })
  if (!created.ok) throw new Error('前提の Group を作れなかった')
  return created.value
}

const okinawa = groupOf('g1', 'invite-1')
const hokkaido = groupOf('g2', 'invite-2')

const record = { id: toPaymentId('p1'), groupId: okinawa.id }

describe('記録に対する操作の認可', () => {
  it('その記録の属するグループの Member なら通る', () => {
    const member = requireRecordMember(okinawa, record, taro.id)

    expect(member.ok && member.value.userId).toBe(taro.id)
  })

  it('ログインしていなければ「ログインが必要」', () => {
    expect(requireRecordMember(okinawa, record, undefined)).toEqual({
      ok: false,
      error: { kind: 'notAuthenticated' },
    })
  })

  it('記録が見つからなければ「見つからない」', () => {
    expect(requireRecordMember(okinawa, undefined, taro.id)).toEqual({
      ok: false,
      error: { kind: 'notFound' },
    })
  })

  it('他のグループの記録を指した場合は「見つからない」', () => {
    // 「存在しない」と「Member でない」を区別する（`docs/domain/group.md`）。
    expect(requireRecordMember(hokkaido, record, taro.id)).toEqual({
      ok: false,
      error: { kind: 'notFound' },
    })
  })

  it('Member でなければ「Member でない」', () => {
    expect(requireRecordMember(okinawa, record, jiro.id)).toEqual({
      ok: false,
      error: { kind: 'notMember' },
    })
  })

  it('未ログインは、記録の有無に依らず先に決まる', () => {
    expect(requireRecordMember(okinawa, undefined, undefined)).toEqual({
      ok: false,
      error: { kind: 'notAuthenticated' },
    })
  })
})

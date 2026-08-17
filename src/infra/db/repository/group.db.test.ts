import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Group } from '../../../domain/group/group'
import { Member } from '../../../domain/group/member'
import { toGroupId, toMemberId } from '../../../domain/id'
import { currency } from '../../../domain/money/currency'
import { groupOf, hanako, jiro, taro } from '../../../usecase/fixture'
import { groups } from '../schema'
import { connectForTest, truncateAll, type TestDatabase } from '../test-support'
import { drizzleGroupRepository } from './group'
import { drizzleUserRepository } from './user'

/**
 * Group 集約の永続化（`docs/adr/0010-testing.md`「実 DB を使うテスト」）。
 *
 * ここで固定するもの：
 * - 集約単位の保存が成立すること
 * - **Group の保存で、追加された Member だけが書き込まれること**
 * - 同じ Group・同じ User の Member を 2 つ作れないこと
 */

let database: TestDatabase

beforeAll(async () => {
  database = await connectForTest()
})

afterAll(async () => {
  await database.close()
})

beforeEach(async () => {
  await truncateAll(database.db)
  const users = drizzleUserRepository(database.db)
  await users.create(taro)
  await users.create(jiro)
  await users.create(hanako)
})

const repository = () => drizzleGroupRepository(database.db)

const stored = async (id = 'g1') => {
  const group = await repository().findById(toGroupId(id))
  if (group === undefined) throw new Error('前提の Group が無い')
  return group
}

describe('Group 集約の保存と読み出し', () => {
  it('Group と、その Member をひとまとまりで読み戻せる', async () => {
    const group = groupOf([{ user: taro, memberId: 'm1' }])

    await repository().create(group)

    expect(await stored()).toEqual(group)
  })

  it('参加コードから読める', async () => {
    await repository().create(groupOf([{ user: taro, memberId: 'm1' }]))

    const found = await repository().findByInviteCode('invite-1')

    expect(found?.id).toBe(toGroupId('g1'))
  })

  it('存在しない Group は undefined', async () => {
    expect(await repository().findById(toGroupId('いない'))).toBeUndefined()
    expect(await repository().findByInviteCode('いない')).toBeUndefined()
  })

  it('Member のいない Group も落ちない', async () => {
    // Member のいない Group はユースケースからは作れない（作成者が必ず Member になる）。
    // Group と Member を一度に読む形が、Member の無い Group を消してしまわないことを確かめる。
    await database.db
      .insert(groups)
      .values({ id: 'g9', name: '空', defaultCurrency: 'JPY', inviteCode: 'invite-9' })

    expect(await repository().findById(toGroupId('g9'))).toEqual({
      id: toGroupId('g9'),
      name: '空',
      defaultCurrency: 'JPY',
      inviteCode: 'invite-9',
      members: [],
    })
  })

  it('その User が Member である Group だけを、Member ごと読める', async () => {
    const okinawa = groupOf(
      [
        { user: taro, memberId: 'm1' },
        { user: jiro, memberId: 'm2' },
      ],
      { id: 'g1', name: '沖縄旅行', inviteCode: 'invite-1' },
    )
    const taiwan = groupOf([{ user: hanako, memberId: 'm3' }], {
      id: 'g2',
      name: '台湾旅行',
      inviteCode: 'invite-2',
    })
    await repository().create(okinawa)
    await repository().create(taiwan)

    const mine = await repository().listByUser(taro.id)

    expect(mine).toEqual([okinawa])
  })

  it('どの Group にも入っていない User には空が返る', async () => {
    await repository().create(groupOf([{ user: taro, memberId: 'm1' }]))

    expect(await repository().listByUser(hanako.id)).toEqual([])
  })

  it('参加コードが既存のグループと重なったら、作成せずにその旨を返す', async () => {
    await repository().create(groupOf([{ user: taro, memberId: 'm1' }]))

    const outcome = await repository().create(
      groupOf([{ user: jiro, memberId: 'm2' }], { id: 'g2', inviteCode: 'invite-1' }),
    )

    expect(outcome).toEqual({ kind: 'inviteCodeTaken' })
    expect(await repository().findById(toGroupId('g2'))).toBeUndefined()
  })
})

describe('Member の書き込み', () => {
  const joinedWith = (group: Group, memberId: string, user: typeof jiro) => {
    const joined = Group.join(group, { memberId: toMemberId(memberId), user, displayName: user.name })
    if (!joined.ok) throw new Error('前提の参加に失敗した')
    return joined.value
  }

  beforeEach(async () => {
    await repository().create(groupOf([{ user: taro, memberId: 'm1' }]))
  })

  it('追加された Member が書き込まれる', async () => {
    await repository().addMembers(joinedWith(await stored(), 'm2', jiro))

    expect((await stored()).members).toHaveLength(2)
  })

  it('2 人が同時に参加しても、片方が消えない', async () => {
    // どちらも「たろうだけがいる」状態を読んでから参加する。
    const seenByJiro = await stored()
    const seenByHanako = await stored()

    await repository().addMembers(joinedWith(seenByJiro, 'm2', jiro))
    await repository().addMembers(joinedWith(seenByHanako, 'm3', hanako))

    const members = (await stored()).members
    expect(members.map((member) => member.userId).sort()).toEqual(
      [taro.id, jiro.id, hanako.id].sort(),
    )
  })

  it('同じ Group・同じ User の Member は 2 つできない', async () => {
    const joined = joinedWith(await stored(), 'm2', jiro)

    await repository().addMembers(joined)
    await repository().addMembers(joined)

    expect((await stored()).members).toHaveLength(2)
  })

  it('既にいる Member の表示名は、書き込みで変わらない', async () => {
    await repository().addMembers(joinedWith(await stored(), 'm2', jiro))
    await repository().saveDisplayName({
      id: toMemberId('m2'),
      groupId: toGroupId('g1'),
      userId: jiro.id,
      displayName: 'じろちゃん',
    })

    // 別の人の参加が、先に変えた表示名を巻き戻さない。
    await repository().addMembers(joinedWith(await stored(), 'm3', hanako))

    expect(Member.byUser((await stored()).members, jiro.id)?.displayName).toBe('じろちゃん')
  })

  it('表示名の書き込みは、その Member だけに効く', async () => {
    await repository().addMembers(joinedWith(await stored(), 'm2', jiro))

    await repository().saveDisplayName({
      id: toMemberId('m1'),
      groupId: toGroupId('g1'),
      userId: taro.id,
      displayName: 'たろちゃん',
    })

    expect(Member.byUser((await stored()).members, taro.id)?.displayName).toBe('たろちゃん')
    expect(Member.byUser((await stored()).members, jiro.id)?.displayName).toBe('じろう')
  })
})

describe('Group 自身の属性の書き込み', () => {
  it('名前と既定通貨を置き換え、Member には触れない', async () => {
    const group = groupOf([{ user: taro, memberId: 'm1' }])
    await repository().create(group)

    const usd = currency('USD')
    if (!usd.ok) throw new Error('前提の通貨を作れなかった')

    await repository().saveSettings({ ...group, name: '石垣島旅行', defaultCurrency: usd.value })

    const after = await stored()
    expect(after.name).toBe('石垣島旅行')
    expect(after.defaultCurrency).toBe('USD')
    expect(after.members).toEqual(group.members)
    expect(after.inviteCode).toBe('invite-1')
  })
})

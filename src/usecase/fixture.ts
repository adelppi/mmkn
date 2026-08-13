import { Group } from '../domain/group/group'
import { User } from '../domain/group/user'
import { toGroupId, toMemberId, toUserId } from '../domain/id'

/**
 * ユースケースのテストが使う前提データ。**テストからだけ使う。**
 *
 * 偽実装（`port/fake.ts`）と組み合わせて、仕掛けを何も使わずにユースケースを回すためのもの。
 * ここが作るのは「既に成立している状態」だけで、振る舞いは持たない。
 */

export const userOf = (id: string, name: string): User => {
  const user = User.create({ id: toUserId(id), name, loginIdentifier: `google:${id}` })
  if (!user.ok) throw new Error('前提の User を作れなかった')
  return user.value
}

export const taro = userOf('u1', 'たろう')
export const jiro = userOf('u2', 'じろう')
export const hanako = userOf('u3', 'はなこ')

/** その Group に参加させる User と、その Member の識別子。 */
export type Participant = {
  readonly user: User
  readonly memberId: string
  readonly displayName?: string
}

/**
 * 作成と参加を済ませた Group を作る。**先頭の Participant が作成者になる。**
 *
 * 表示名を渡さなかった Participant は、その User の名前がそのまま表示名になる
 * （作成者の初期値の規則に揃えてある）。
 */
export const groupOf = (
  participants: readonly Participant[],
  overrides: { id?: string; name?: string; defaultCurrency?: string; inviteCode?: string } = {},
): Group => {
  const [creator, ...rest] = participants
  if (creator === undefined) throw new Error('前提の Group には作成者が要る')

  const created = Group.create({
    id: toGroupId(overrides.id ?? 'g1'),
    name: overrides.name ?? '沖縄旅行',
    defaultCurrency: overrides.defaultCurrency ?? 'JPY',
    inviteCode: overrides.inviteCode ?? 'invite-1',
    creator: creator.user,
    creatorMemberId: toMemberId(creator.memberId),
  })
  if (!created.ok) throw new Error('前提の Group を作れなかった')

  return rest.reduce((group, participant) => {
    const joined = Group.join(group, {
      memberId: toMemberId(participant.memberId),
      user: participant.user,
      displayName: participant.displayName ?? participant.user.name,
    })
    if (!joined.ok) throw new Error('前提の参加に失敗した')
    return joined.value
  }, created.value)
}

import { idEquals, type GroupId, type MemberId, type UserId } from '../id'
import { err, ok, type Result } from '../result'
import { requireMember, type MemberAccessDenied, type NotMember } from './access'
import { Member, type DisplayNameInvalid } from './member'
import { constrainText, GROUP_NAME_MAX_LENGTH } from './text'
import type { User } from './user'

/**
 * お金の動きを管理する単位（`docs/domain/group.md`「Group の属性」）。
 *
 * Group と、その Member をひとまとまりとして扱う（`docs/adr/0008-layer-internals.md`「永続化の単位」）。
 */
export type Group = {
  readonly id: GroupId
  readonly name: string
  /**
   * 金額を入力するときの初期値。**扱える通貨を制限しない**（`docs/domain/money.md`）。
   *
   * **その通貨コードを扱えるかどうかは、ここではまだ確かめていない。**
   * 判定には通貨表（`src/domain/money/`）が要るため、表が入った時点でここに検査を足す。
   */
  readonly defaultCurrency: string
  /** 参加コード。作成時に受け取り、以後変更も再生成もしない（形式は `docs/adr/0002-invite-code.md`）。 */
  readonly inviteCode: string
  /** この Group の Member。**並びは意味を持たない**（Member はグループ内の順序を持たない）。 */
  readonly members: readonly Member[]
}

/** グループ名が制約を満たさなかったときの失敗。 */
export type GroupNameInvalid = { kind: 'groupNameEmpty' } | { kind: 'groupNameTooLong' }

export type CreateGroupFailure = GroupNameInvalid | DisplayNameInvalid
export type ChangeSettingsFailure = MemberAccessDenied | GroupNameInvalid
export type JoinFailure = DisplayNameInvalid
export type ChangeDisplayNameFailure = NotMember | DisplayNameInvalid

const groupName = (raw: string): Result<string, GroupNameInvalid> => {
  const constrained = constrainText(raw, GROUP_NAME_MAX_LENGTH)
  if (constrained.ok) return constrained

  return err(constrained.error === 'empty' ? { kind: 'groupNameEmpty' } : { kind: 'groupNameTooLong' })
}

/**
 * グループを作成する（`docs/domain/group.md`「グループを作成する」）。
 *
 * 作成者は Member になり、その表示名の初期値には User の名前を使う。
 * ID と参加コードは受け取るだけで、ここでは作らない（`docs/adr/0008-layer-internals.md`）。
 */
const create = (input: {
  id: GroupId
  name: string
  defaultCurrency: string
  inviteCode: string
  creator: User
  creatorMemberId: MemberId
}): Result<Group, CreateGroupFailure> => {
  const name = groupName(input.name)
  if (!name.ok) return name

  const creator = Member.create({
    id: input.creatorMemberId,
    groupId: input.id,
    userId: input.creator.id,
    displayName: input.creator.name,
  })
  // User の名前は作成時に検査済みで、表示名と同じ上限であるため、ここは通らない。
  // それでも握りつぶさず失敗として返す（`docs/domain/group.md`「前提条件を満たさなかったとき」）。
  if (!creator.ok) return creator

  return ok({
    id: input.id,
    name: name.value,
    defaultCurrency: input.defaultCurrency,
    inviteCode: input.inviteCode,
    // 作成者以外の Member は作らない。作成者に他と異なる立場は与えない。
    members: [creator.value],
  })
}

/**
 * グループ設定を変更する（`docs/domain/group.md`「グループ設定を変更する」）。
 *
 * 渡されたものだけを変える。参加コードと Member は変わらず、変更前の値も残らない。
 * **同時に変更されても失敗させない。後から届いた方が勝つ**（`docs/adr/0005-data-access-and-authorization.md`）。
 */
const changeSettings = (
  group: Group,
  input: { actor: UserId | undefined; name?: string; defaultCurrency?: string },
): Result<Group, ChangeSettingsFailure> => {
  const member = requireMember(group, input.actor)
  if (!member.ok) return member

  const name = input.name === undefined ? ok(group.name) : groupName(input.name)
  if (!name.ok) return name

  return ok({
    ...group,
    name: name.value,
    defaultCurrency: input.defaultCurrency ?? group.defaultCurrency,
  })
}

/**
 * グループに参加する（`docs/domain/group.md`「グループに参加する」）。
 *
 * 参加コードから Group を解決するのは呼び出し側で、見つからなければ「存在しない」失敗になる
 * （`access.ts` の `requireGroupMember`）。
 *
 * **既に Member であれば、新しい Member を作らず、入力された表示名も反映しない。**
 * 表示名を変えるのは「表示名を変更する」の責務であり、参加は何度行っても結果が変わらない。
 */
const join = (
  group: Group,
  input: { memberId: MemberId; user: User; displayName: string },
): Result<Group, JoinFailure> => {
  // 入力の検査を先に通す。同じ入力なら、何度参加しても同じ結果になる。
  const member = Member.create({
    id: input.memberId,
    groupId: group.id,
    userId: input.user.id,
    displayName: input.displayName,
  })
  if (!member.ok) return member

  if (Member.byUser(group.members, input.user.id) !== undefined) return ok(group)

  return ok({ ...group, members: [...group.members, member.value] })
}

/**
 * 表示名を変更する（`docs/domain/group.md`「表示名を変更する」）。
 *
 * 前提条件は「対象が、そのグループの Member であること」。
 * 同じ User の、他のグループの Member の表示名は変わらない。
 */
const changeDisplayName = (
  group: Group,
  input: { member: MemberId; displayName: string },
): Result<Group, ChangeDisplayNameFailure> => {
  const target = Member.byId(group.members, input.member)
  if (target === undefined) return err({ kind: 'notMember' })

  const renamed = Member.rename(target, input.displayName)
  if (!renamed.ok) return renamed

  return ok({
    ...group,
    members: group.members.map((member) =>
      idEquals(member.id, renamed.value.id) ? renamed.value : member,
    ),
  })
}

/** Group への操作（`docs/domain/group.md`「操作」）。 */
export const Group = { create, changeSettings, join, changeDisplayName }

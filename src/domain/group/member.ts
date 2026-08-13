import { idEquals, type GroupId, type MemberId, type UserId } from '../id'
import { err, ok, type Result } from '../result'
import { constrainText, DISPLAY_NAME_MAX_LENGTH } from './text'

/**
 * ある User の、ある Group における立場（`docs/domain/group.md`「Member の属性」）。
 *
 * User そのものではない。同じ User が複数の Group に参加すれば、それぞれ別の Member になる。
 */
export type Member = {
  readonly id: MemberId
  readonly groupId: GroupId
  /** 対応する User。User を持たない Member は存在しない。 */
  readonly userId: UserId
  /** その Group 内で表示する名前。Group ごとに独立している。 */
  readonly displayName: string
}

/** 表示名が制約を満たさなかったときの失敗。 */
export type DisplayNameInvalid = { kind: 'displayNameEmpty' } | { kind: 'displayNameTooLong' }

const displayName = (raw: string): Result<string, DisplayNameInvalid> => {
  const constrained = constrainText(raw, DISPLAY_NAME_MAX_LENGTH)
  if (constrained.ok) return constrained

  return err(
    constrained.error === 'empty' ? { kind: 'displayNameEmpty' } : { kind: 'displayNameTooLong' },
  )
}

const create = (input: {
  id: MemberId
  groupId: GroupId
  userId: UserId
  displayName: string
}): Result<Member, DisplayNameInvalid> => {
  const name = displayName(input.displayName)
  if (!name.ok) return name

  return ok({
    id: input.id,
    groupId: input.groupId,
    userId: input.userId,
    displayName: name.value,
  })
}

/** 表示名を変更する（`docs/domain/group.md`「表示名を変更する」）。 */
const rename = (member: Member, to: string): Result<Member, DisplayNameInvalid> => {
  const name = displayName(to)
  if (!name.ok) return name

  return ok({ ...member, displayName: name.value })
}

/** その User の Member を引く。参加していなければ `undefined`。 */
const byUser = (members: readonly Member[], userId: UserId): Member | undefined =>
  members.find((member) => idEquals(member.userId, userId))

/** 識別子で Member を引く。その Group にいなければ `undefined`。 */
const byId = (members: readonly Member[], memberId: MemberId): Member | undefined =>
  members.find((member) => idEquals(member.id, memberId))

/**
 * Member への操作と参照。
 *
 * ID は受け取るだけで、ここでは作らない（`docs/adr/0008-layer-internals.md`）。
 */
export const Member = { create, rename, byUser, byId }

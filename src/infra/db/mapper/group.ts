import type { Group } from '../../../domain/group/group'
import type { Member } from '../../../domain/group/member'
import { toGroupId, toMemberId, toUserId } from '../../../domain/id'
import { toCurrency } from './value'

/**
 * `groups` / `members` の行と `Group` 集約の変換。
 *
 * **行の形をここで明示的に宣言する**（理由は `mapper/user.ts` と同じ）。
 */

export type GroupRow = {
  readonly id: string
  readonly name: string
  readonly defaultCurrency: string
  readonly inviteCode: string
}

export type MemberRow = {
  readonly id: string
  readonly groupId: string
  readonly userId: string
  readonly displayName: string
}

export const toMember = (row: MemberRow): Member => ({
  id: toMemberId(row.id),
  groupId: toGroupId(row.groupId),
  userId: toUserId(row.userId),
  displayName: row.displayName,
})

/** Group と、その Member をひとまとまりに戻す（`docs/adr/0008`「永続化の単位」）。 */
export const toGroup = (row: GroupRow, members: readonly MemberRow[]): Group => ({
  id: toGroupId(row.id),
  name: row.name,
  defaultCurrency: toCurrency(row.defaultCurrency),
  inviteCode: row.inviteCode,
  // **Member の並びは意味を持たない**（Member はグループ内の順序を持たない）。
  members: members.map(toMember),
})

export const fromGroup = (group: Group): GroupRow => ({
  id: group.id,
  name: group.name,
  defaultCurrency: group.defaultCurrency,
  inviteCode: group.inviteCode,
})

export const fromMember = (member: Member): MemberRow => ({
  id: member.id,
  groupId: member.groupId,
  userId: member.userId,
  displayName: member.displayName,
})

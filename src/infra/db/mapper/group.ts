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

/**
 * Group 1 件と Member 1 件を並べた行。**Member のいない Group では Member 側が null になる**
 * （外部結合で読むため）。
 */
export type GroupWithMemberRow = {
  readonly group: GroupRow
  readonly member: MemberRow | null
}

/** Group と、その Member をひとまとまりに戻す（`docs/adr/0008`「永続化の単位」）。 */
export const toGroup = (row: GroupRow, members: readonly MemberRow[]): Group => ({
  id: toGroupId(row.id),
  name: row.name,
  defaultCurrency: toCurrency(row.defaultCurrency),
  inviteCode: row.inviteCode,
  // **Member の並びは意味を持たない**（Member はグループ内の順序を持たない）。
  members: members.map(toMember),
})

/**
 * 結合して読んだ行を、Group ごとにたたみ直す。
 *
 * 1 つの Group は Member の数だけ行に展開されるため、Group の識別子でまとめ直す。
 * **Member のいない Group も 1 行として返るため、Member を持たない Group として組み立てる。**
 */
export const toGroups = (rows: readonly GroupWithMemberRow[]): readonly Group[] => {
  const folded = new Map<string, { readonly row: GroupRow; readonly members: MemberRow[] }>()

  for (const { group, member } of rows) {
    const bucket = folded.get(group.id) ?? { row: group, members: [] }
    if (member !== null) bucket.members.push(member)
    folded.set(group.id, bucket)
  }

  return [...folded.values()].map(({ row, members }) => toGroup(row, members))
}

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

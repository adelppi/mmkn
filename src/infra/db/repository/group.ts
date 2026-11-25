import { eq, inArray, type SQL } from 'drizzle-orm'
import type { Group } from '../../../domain/group/group'
import type { Member } from '../../../domain/group/member'
import type { GroupId, UserId } from '../../../domain/id'
import type { CreateGroupOutcome, GroupRepository } from '../../../usecase/port/group-repository'
import type { Database } from '../client'
import { fromGroup, fromMember, toGroups } from '../mapper/group'
import { groups, members } from '../schema'
import { GROUPS_INVITE_CODE_UNIQUE, isUniqueViolation } from './constraint'

/** `GroupRepository` の実装（`docs/adr/0005-data-access-and-authorization.md`）。 */
export const drizzleGroupRepository = (db: Database): GroupRepository => {
  /**
   * Group と、その Member を **1 本の問い合わせ**で読む。Member を別に引くと往復が 2 段になる。
   *
   * **外部結合にするのは、Member のいない Group を落とさないためである。**
   */
  const loadAll = async (where: SQL): Promise<readonly Group[]> =>
    toGroups(
      await db
        .select({ group: groups, member: members })
        .from(groups)
        .leftJoin(members, eq(members.groupId, groups.id))
        .where(where),
    )

  /** 鍵で 1 件に絞って読む。 */
  const load = async (where: SQL): Promise<Group | undefined> => {
    const [group] = await loadAll(where)
    return group
  }

  return {
    async findById(id: GroupId) {
      return load(eq(groups.id, id))
    },

    async findByInviteCode(inviteCode: string) {
      return load(eq(groups.inviteCode, inviteCode))
    },

    async listByUser(userId: UserId) {
      // **他の Member も読むため、その User の行だけに絞らない。** 絞り込むのは Group の側である。
      const belongs = db
        .select({ groupId: members.groupId })
        .from(members)
        .where(eq(members.userId, userId))

      return loadAll(inArray(groups.id, belongs))
    },

    async create(group: Group): Promise<CreateGroupOutcome> {
      try {
        // Group と作成者の Member を 1 つのトランザクションで書き込む。
        // 途中で失敗して Member のいない Group が残ることはない（`docs/adr/0008`）。
        await db.transaction(async (tx) => {
          await tx.insert(groups).values(fromGroup(group))
          await tx.insert(members).values(group.members.map(fromMember))
        })
      } catch (error) {
        // 生成した参加コードが既存のグループと重なっていた（`docs/adr/0002`）。
        if (isUniqueViolation(error, GROUPS_INVITE_CODE_UNIQUE)) {
          return { kind: 'inviteCodeTaken' }
        }
        throw error
      }

      return { kind: 'created' }
    },

    async saveSettings(group: Group) {
      // Member には触れない。名前と既定通貨だけを置き換える（後勝ち。`docs/domain/group.md`）。
      await db
        .update(groups)
        .set({ name: group.name, defaultCurrency: group.defaultCurrency })
        .where(eq(groups.id, group.id))
    },

    async addMembers(group: Group) {
      // **追加された Member だけが書き込まれる。** 既にいる Member は
      // 「同じ Group・同じ User の組が 2 つ存在しない」制約に当たり、そのまま残る（`docs/adr/0005`）。
      // 一覧の置き換えをしないため、2 人が同時に参加しても片方が消えることはない。
      await db.insert(members).values(group.members.map(fromMember)).onConflictDoNothing()
    },

    async saveDisplayName(member: Member) {
      await db
        .update(members)
        .set({ displayName: member.displayName })
        .where(eq(members.id, member.id))
    },
  }
}

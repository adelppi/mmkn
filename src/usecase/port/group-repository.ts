import type { Group } from '../../domain/group/group'
import type { Member } from '../../domain/group/member'
import type { GroupId, UserId } from '../../domain/id'

/** Group 集約の永続化ポート（`docs/adr/0008-layer-internals.md`「永続化の単位」）。 */

/** `inviteCodeTaken` は参加コードの衝突を表し、呼び出し側が生成し直す（`docs/adr/0002-invite-code.md`）。 */
export type CreateGroupOutcome = { readonly kind: 'created' } | { readonly kind: 'inviteCodeTaken' }

export type GroupRepository = {
  /** Group と、その Member をひとまとまりで読む。 */
  findById(id: GroupId): Promise<Group | undefined>

  /** 参加コードから Group を読む。見つからないことは失敗ではない。 */
  findByInviteCode(inviteCode: string): Promise<Group | undefined>

  /** その User が Member である Group を、それぞれ Member ごと読む。**並び順はここでは決めない。** */
  listByUser(userId: UserId): Promise<readonly Group[]>

  /** Group と、その作成者の Member を書き込む。 */
  create(group: Group): Promise<CreateGroupOutcome>

  /** Group 自身の属性（名前・既定通貨）だけを書き込む。**Member には触れない。** */
  saveSettings(group: Group): Promise<void>

  /** **追加された Member だけを書き込む**（`docs/adr/0008-layer-internals.md`）。既にいる Member の内容は変わらない。 */
  addMembers(group: Group): Promise<void>

  /** 1 人の Member の表示名だけを書き込む。**他の Member には触れない。** */
  saveDisplayName(member: Member): Promise<void>
}

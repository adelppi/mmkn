import type { Group } from '../../domain/group/group'
import type { Member } from '../../domain/group/member'
import type { GroupId } from '../../domain/id'

/**
 * Group 集約の永続化ポート（`docs/adr/0008-layer-internals.md`「永続化の単位」）。
 *
 * 集約は **Group と、その Member** をひとまとまりとしたもの。
 * **トランザクションは実装の中に閉じ、ここにはその存在が現れない。**
 *
 * Group には楽観ロックの版を持たせない（`docs/adr/0005-data-access-and-authorization.md`）。
 * `docs/domain/group.md`「境界・例外ケース」がグループ名・既定通貨・表示名・場の対応づけの
 * 同時変更をいずれも**後勝ち**と定めているため、版を持たせるとドメインが失敗させないと
 * 決めたものを実現方式の側で失敗させることになる。
 */

/**
 * 作成の結果。
 *
 * `inviteCodeTaken` は、生成した参加コードが既存のグループと重なっていたことを表す
 * （`docs/adr/0002-invite-code.md`「衝突は起きない前提にしない」）。呼び出し側は
 * 生成し直してから作成を完了する。
 */
export type CreateGroupOutcome = { readonly kind: 'created' } | { readonly kind: 'inviteCodeTaken' }

export type GroupRepository = {
  /** Group と、その Member をひとまとまりで読む。 */
  findById(id: GroupId): Promise<Group | undefined>

  /**
   * 参加コードから Group を読む。
   *
   * 見つからないことは失敗ではない。**「存在しない」として扱うのは呼び出し側**
   * （`docs/domain/group.md`「前提条件を満たさなかったとき」の 3 区別）。
   */
  findByInviteCode(inviteCode: string): Promise<Group | undefined>

  /**
   * Group と、その作成者の Member を書き込む。
   *
   * **途中で失敗して Member のいない Group が残ることはない**（`docs/adr/0008`）。
   */
  create(group: Group): Promise<CreateGroupOutcome>

  /** Group 自身の属性（名前・既定通貨）だけを書き込む。**Member には触れない。** */
  saveSettings(group: Group): Promise<void>

  /**
   * **追加された Member だけを書き込む**（`docs/adr/0008-layer-internals.md`）。
   *
   * 現在の Member 一覧で置き換える形にはしない。全体を置き換えると、2 人が同時に参加したときに
   * 片方が消える（`docs/domain/group.md`「境界・例外ケース」はどちらも Member になると定めている）。
   * 既にいる Member の内容は、この呼び出しでは変わらない。
   */
  addMembers(group: Group): Promise<void>

  /** 1 人の Member の表示名だけを書き込む。**他の Member には触れない。** */
  saveDisplayName(member: Member): Promise<void>
}

import type { GroupId, PaymentId } from '../../domain/id'
import type { Payment } from '../../domain/record/payment'
import type { Version, Versioned, VersionedDelete, VersionedWrite } from '../usecase'

/**
 * Payment 集約の永続化ポート（`docs/adr/0008-layer-internals.md`「永続化の単位」）。
 *
 * 集約は **Payment と、その負担者**。**トランザクションは実装の中に閉じる。**
 *
 * 記録単位の楽観ロック（`docs/adr/0005-data-access-and-authorization.md`）を、
 * **取得側は記録と版の組で返し、更新・削除側は操作者が見ていた版を引数で受ける**形で表す。
 */
export type PaymentRepository = {
  /** 記録と版を組で読む。 */
  find(id: PaymentId): Promise<Versioned<Payment> | undefined>

  /**
   * そのグループの Payment をすべて読む。収支・清算案・一覧の材料になる。
   *
   * **並び順はここでは決めない**（`docs/domain/record.md`「記録の並び」がドメインの規則として持つ）。
   */
  listByGroup(groupId: GroupId): Promise<readonly Versioned<Payment>[]>

  /** Payment と、その負担者を書き込む。最初の版を返す。 */
  create(payment: Payment): Promise<Version>

  /** 操作者が見ていた版（`seen`）で更新する。版が変わっていれば `stale` を返す。 */
  update(payment: Payment, seen: Version): Promise<VersionedWrite>

  /** 操作者が見ていた版（`seen`）で削除する。**削除履歴は残さない**（`docs/domain/record.md`）。 */
  remove(id: PaymentId, seen: Version): Promise<VersionedDelete>
}

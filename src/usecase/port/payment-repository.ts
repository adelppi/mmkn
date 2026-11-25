import type { GroupId, PaymentId } from '../../domain/id'
import type { Payment } from '../../domain/record/payment'
import type { Version, Versioned, VersionedDelete, VersionedWrite } from '../usecase'

/** Payment 集約の永続化ポート（`docs/adr/0008-layer-internals.md`「永続化の単位」）。 */
export type PaymentRepository = {
  /** 記録と版を組で読む。 */
  find(id: PaymentId): Promise<Versioned<Payment> | undefined>

  /** そのグループの Payment をすべて読む。**並び順はここでは決めない。** */
  listByGroup(groupId: GroupId): Promise<readonly Versioned<Payment>[]>

  /** 複数のグループの Payment を**まとめて**読む。グループの数だけ読み取りを走らせないためにある。 */
  listByGroups(groupIds: readonly GroupId[]): Promise<readonly Versioned<Payment>[]>

  /** Payment と、その負担者を書き込む。最初の版を返す。 */
  create(payment: Payment): Promise<Version>

  /** 操作者が見ていた版（`seen`）で更新する。版が変わっていれば `stale` を返す。 */
  update(payment: Payment, seen: Version): Promise<VersionedWrite>

  /** 操作者が見ていた版（`seen`）で削除する。**削除履歴は残さない**（`docs/domain/record.md`）。 */
  remove(id: PaymentId, seen: Version): Promise<VersionedDelete>
}

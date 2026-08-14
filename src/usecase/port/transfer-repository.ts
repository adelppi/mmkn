import type { GroupId, TransferId } from '../../domain/id'
import type { Transfer } from '../../domain/record/transfer'
import type { Version, Versioned, VersionedDelete, VersionedWrite } from '../usecase'

/**
 * Transfer 集約の永続化ポート（`docs/adr/0008-layer-internals.md`「永続化の単位」）。
 *
 * 集約は **Transfer** 単体。形は `PaymentRepository` と同じで、楽観ロックの版も同じ扱いをする
 * （`docs/adr/0005-data-access-and-authorization.md`「楽観ロックを持つのは Payment と Transfer だけ」）。
 */
export type TransferRepository = {
  /** 記録と版を組で読む。 */
  find(id: TransferId): Promise<Versioned<Transfer> | undefined>

  /** そのグループの Transfer をすべて読む。収支・清算案・一覧の材料になる。 */
  listByGroup(groupId: GroupId): Promise<readonly Versioned<Transfer>[]>

  /** Transfer を書き込む。最初の版を返す。 */
  create(transfer: Transfer): Promise<Version>

  /** 操作者が見ていた版（`seen`）で更新する。版が変わっていれば `stale` を返す。 */
  update(transfer: Transfer, seen: Version): Promise<VersionedWrite>

  /** 操作者が見ていた版（`seen`）で削除する。 */
  remove(id: TransferId, seen: Version): Promise<VersionedDelete>
}

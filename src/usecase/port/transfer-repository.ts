import type { GroupId, TransferId } from '../../domain/id'
import type { Transfer } from '../../domain/record/transfer'
import type { Version, Versioned, VersionedDelete, VersionedWrite } from '../usecase'

/** Transfer 集約の永続化ポート（`docs/adr/0008-layer-internals.md`「永続化の単位」）。 */
export type TransferRepository = {
  /** 記録と版を組で読む。 */
  find(id: TransferId): Promise<Versioned<Transfer> | undefined>

  /** そのグループの Transfer をすべて読む。収支・清算案・一覧の材料になる。 */
  listByGroup(groupId: GroupId): Promise<readonly Versioned<Transfer>[]>

  /** 複数のグループの Transfer を**まとめて**読む。グループの数だけ読み取りを走らせないためにある。 */
  listByGroups(groupIds: readonly GroupId[]): Promise<readonly Versioned<Transfer>[]>

  /** Transfer を書き込む。最初の版を返す。 */
  create(transfer: Transfer): Promise<Version>

  /** 操作者が見ていた版（`seen`）で更新する。版が変わっていれば `stale` を返す。 */
  update(transfer: Transfer, seen: Version): Promise<VersionedWrite>

  /** 操作者が見ていた版（`seen`）で削除する。 */
  remove(id: TransferId, seen: Version): Promise<VersionedDelete>
}

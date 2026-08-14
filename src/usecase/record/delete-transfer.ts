import type { GroupAccessDenied } from '../../domain/group/access'
import type { GroupId, TransferId, UserId } from '../../domain/id'
import { err, ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { TransferRepository } from '../port/transfer-repository'
import type { UseCase, Version } from '../usecase'
import { loadGroupAsMember } from '../group/access'
import { requireRecord, type VersionConflict } from './access'

/**
 * 送金を削除する（`docs/domain/record.md`「削除」・`docs/features.md` #7）。
 *
 * **その記録は完全に存在しなくなる。削除履歴を残さず、復元もできない。**
 */

export type DeleteTransferInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  readonly transfer: TransferId
  /** 操作者が見ていた版。これが変わっていれば削除は失敗する。 */
  readonly version: Version
}

export type DeleteTransferError = GroupAccessDenied | VersionConflict

export const deleteTransfer =
  (deps: {
    transfers: TransferRepository
    groups: GroupRepository
  }): UseCase<DeleteTransferInput, void, DeleteTransferError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const found = await deps.transfers.find(input.transfer)
    const target = requireRecord(loaded.value.group, found, input.actor)
    if (!target.ok) return target

    const removed = await deps.transfers.remove(input.transfer, input.version)
    if (removed.kind === 'stale') return err({ kind: 'versionConflict' })

    return ok(undefined)
  }

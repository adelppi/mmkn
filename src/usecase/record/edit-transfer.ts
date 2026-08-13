import type { GroupId, MemberId, TransferId, UserId } from '../../domain/id'
import { Transfer, type EditTransferFailure } from '../../domain/record/transfer'
import { err, ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { TransferRepository } from '../port/transfer-repository'
import type { UseCase, Version, Versioned } from '../usecase'
import { loadGroupAsMember } from '../group/access'
import { requireRecord, type VersionConflict } from './access'

/**
 * 送金を編集する（`docs/domain/record.md`「編集」・`docs/features.md` #7）。
 *
 * **過去の Transfer との整合性を検査しない。** 編集後の内容がそのまま現在の記録になる。
 */

export type EditTransferInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  readonly transfer: TransferId
  /** 操作者が見ていた版。これが変わっていれば編集は失敗する。 */
  readonly version: Version
  readonly sender: MemberId
  readonly recipient: MemberId
  readonly amount: number
  readonly currency: string
  readonly occurredOn: string
}

export type EditTransferError = EditTransferFailure | VersionConflict

export const editTransfer =
  (deps: {
    transfers: TransferRepository
    groups: GroupRepository
  }): UseCase<EditTransferInput, Versioned<Transfer>, EditTransferError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const found = await deps.transfers.find(input.transfer)
    const target = requireRecord(loaded.value.group, found, input.actor)
    if (!target.ok) return target

    const edited = Transfer.edit(target.value.record, {
      group: loaded.value.group,
      actor: input.actor,
      sender: input.sender,
      recipient: input.recipient,
      amount: input.amount,
      currency: input.currency,
      occurredOn: input.occurredOn,
    })
    if (!edited.ok) return edited

    const written = await deps.transfers.update(edited.value, input.version)
    if (written.kind === 'stale') return err({ kind: 'versionConflict' })

    return ok({ record: edited.value, version: written.version })
  }

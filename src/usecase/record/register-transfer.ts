import type { GroupAccessDenied } from '../../domain/group/access'
import type { GroupId, MemberId, UserId } from '../../domain/id'
import { Transfer, type CreateTransferFailure } from '../../domain/record/transfer'
import { ok } from '../../domain/result'
import type { Clock } from '../port/clock'
import type { GroupRepository } from '../port/group-repository'
import type { IdGenerator } from '../port/id-generator'
import type { TransferRepository } from '../port/transfer-repository'
import type { UseCase, Versioned } from '../usecase'
import { loadGroupAsMember } from '../group/access'

/**
 * 送金を記録する（`docs/domain/record.md`「Transfer（送金）」・`docs/features.md` #6）。
 *
 * **清算案から登録したものと、手で入力したものを区別しない**（`docs/domain/settlement.md`）。
 * 金額を入力しない導線は `register-settlement-transfer.ts` にある。
 */

export type RegisterTransferInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
  readonly sender: MemberId
  readonly recipient: MemberId
  readonly amount: number
  readonly currency: string
  readonly occurredOn: string
}

export type RegisterTransferError = GroupAccessDenied | CreateTransferFailure

export const registerTransfer =
  (deps: {
    transfers: TransferRepository
    groups: GroupRepository
    ids: IdGenerator
    clock: Clock
  }): UseCase<RegisterTransferInput, Versioned<Transfer>, RegisterTransferError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const transfer = Transfer.create({
      id: deps.ids.transferId(),
      group: loaded.value.group,
      sender: input.sender,
      recipient: input.recipient,
      amount: input.amount,
      currency: input.currency,
      occurredOn: input.occurredOn,
      recordedBy: loaded.value.member.userId,
      recordedAt: deps.clock.now(),
    })
    if (!transfer.ok) return transfer

    const version = await deps.transfers.create(transfer.value)

    return ok({ record: transfer.value, version })
  }

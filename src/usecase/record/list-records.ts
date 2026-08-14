import type { GroupAccessDenied } from '../../domain/group/access'
import type { Group } from '../../domain/group/group'
import type { GroupId, UserId } from '../../domain/id'
import { compareRecords, type AnyRecord } from '../../domain/record/record'
import { ok } from '../../domain/result'
import type { GroupRepository } from '../port/group-repository'
import type { PaymentRepository } from '../port/payment-repository'
import type { TransferRepository } from '../port/transfer-repository'
import type { UseCase, Versioned } from '../usecase'
import { loadGroupAsMember } from '../group/access'

/**
 * グループの記録を一覧する（`docs/domain/record.md`「記録の並び」）。
 *
 * **Payment と Transfer をまとめて 1 つの列として扱う。種類によって分けない。**
 * 並びの規則はドメインが持つ（`compareRecords`）。
 *
 * 記録と一緒に版を返すのは、そのまま編集・削除に進めるようにするため
 * （`docs/adr/0005-data-access-and-authorization.md`：取得側は記録と版を組で返す）。
 */

export type ListRecordsInput = {
  readonly actor: UserId | undefined
  readonly group: GroupId
}

export type ListRecordsOutput = {
  readonly group: Group
  /** 発生日の新しい順、同じ発生日は登録日時の新しい順。 */
  readonly records: readonly Versioned<AnyRecord>[]
}

export type ListRecordsError = GroupAccessDenied

export const listRecords =
  (deps: {
    payments: PaymentRepository
    transfers: TransferRepository
    groups: GroupRepository
  }): UseCase<ListRecordsInput, ListRecordsOutput, ListRecordsError> =>
  async (input) => {
    const loaded = await loadGroupAsMember(deps.groups, input.group, input.actor)
    if (!loaded.ok) return loaded

    const [payments, transfers] = await Promise.all([
      deps.payments.listByGroup(input.group),
      deps.transfers.listByGroup(input.group),
    ])

    const records: Versioned<AnyRecord>[] = [...payments, ...transfers]
    records.sort((a, b) => compareRecords(a.record, b.record))

    return ok({ group: loaded.value.group, records })
  }

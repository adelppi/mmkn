import { toGroupId, toMemberId, toTransferId, toUserId } from '../../../domain/id'
import type { Transfer } from '../../../domain/record/transfer'
import { toMoney, toPlainDate } from './value'

/**
 * `transfers` の行と `Transfer` の変換。
 *
 * **行の形をここで明示的に宣言する**（理由は `mapper/user.ts` と同じ）。
 * Transfer は「内容」を持たないため、対応する列も無い（`docs/domain/record.md`）。
 */

export type TransferRow = {
  readonly id: string
  readonly groupId: string
  readonly senderMemberId: string
  readonly recipientMemberId: string
  readonly amount: number
  readonly currency: string
  readonly occurredOn: string
  readonly recordedBy: string
  readonly recordedAt: Date
}

export const toTransfer = (row: TransferRow): Transfer => ({
  id: toTransferId(row.id),
  groupId: toGroupId(row.groupId),
  sender: toMemberId(row.senderMemberId),
  recipient: toMemberId(row.recipientMemberId),
  money: toMoney(row.amount, row.currency),
  occurredOn: toPlainDate(row.occurredOn),
  recordedBy: toUserId(row.recordedBy),
  recordedAt: row.recordedAt,
})

export const fromTransfer = (transfer: Transfer): TransferRow => ({
  id: transfer.id,
  groupId: transfer.groupId,
  senderMemberId: transfer.sender,
  recipientMemberId: transfer.recipient,
  amount: transfer.money.amount,
  currency: transfer.money.currency,
  occurredOn: transfer.occurredOn,
  recordedBy: transfer.recordedBy,
  recordedAt: transfer.recordedAt,
})

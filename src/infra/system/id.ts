import { createId } from '@paralleldrive/cuid2'
import {
  toGroupId,
  toMemberId,
  toPaymentId,
  toTransferId,
  toUserId,
} from '../../domain/id'
import type { IdGenerator } from '../../usecase/port/id-generator'

/** `IdGenerator` の実装（`docs/adr/0008-layer-internals.md`「識別子の生成」）。参加コードと同じ生成方法を使う。 */
export const cuid2IdGenerator: IdGenerator = {
  userId: () => toUserId(createId()),
  groupId: () => toGroupId(createId()),
  memberId: () => toMemberId(createId()),
  paymentId: () => toPaymentId(createId()),
  transferId: () => toTransferId(createId()),
}

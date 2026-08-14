import { createId } from '@paralleldrive/cuid2'
import {
  toGroupId,
  toMemberId,
  toPaymentId,
  toTransferId,
  toUserId,
} from '../../domain/id'
import type { IdGenerator } from '../../usecase/port/id-generator'

/**
 * `IdGenerator` の実装。
 *
 * **参加コードと同じ生成方法（cuid2）を使い、ID と参加コードで別の生成器を持たない**
 * （`docs/adr/0008-layer-internals.md`「識別子の生成」・`docs/adr/0002-invite-code.md`）。
 *
 * **連番にしない。** `docs/domain/group.md`「前提条件を満たさなかったとき」が、
 * 「存在しない」と「Member でない」を区別する前提として Group の識別子に推測不能性を要求している。
 * cuid2 は乱数由来で並びに規則性がないため、発行済みの ID から他の ID を推測できない。
 */
export const cuid2IdGenerator: IdGenerator = {
  userId: () => toUserId(createId()),
  groupId: () => toGroupId(createId()),
  memberId: () => toMemberId(createId()),
  paymentId: () => toPaymentId(createId()),
  transferId: () => toTransferId(createId()),
}

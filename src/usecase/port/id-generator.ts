import type { GroupId, MemberId, PaymentId, TransferId, UserId } from '../../domain/id'

/** 識別子を生成するポート（`docs/adr/0008-layer-internals.md`「識別子の生成」）。**推測できる値（連番など）を返さない。** */
export type IdGenerator = {
  userId(): UserId
  groupId(): GroupId
  memberId(): MemberId
  paymentId(): PaymentId
  transferId(): TransferId
}

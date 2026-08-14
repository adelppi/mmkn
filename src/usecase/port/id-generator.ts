import type { GroupId, MemberId, PaymentId, TransferId, UserId } from '../../domain/id'

/**
 * 識別子を生成するポート（`docs/adr/0008-layer-internals.md`「識別子の生成」）。
 *
 * ID はユースケースがここから受け取り、ドメインのファクトリは受け取るだけとする。
 * ドメインが生成器を直接呼ばないのは、ドメイン層がライブラリもランタイム API も持たないため。
 *
 * **返す ID は参加コードと同じ性質（乱数由来・他の ID から推測できない）を満たす。連番にしない。**
 * `docs/domain/group.md`「前提条件を満たさなかったとき」が、「存在しない」と「Member でない」を
 * 区別する前提として Group の識別子に推測不能性を要求している。
 */
export type IdGenerator = {
  userId(): UserId
  groupId(): GroupId
  memberId(): MemberId
  paymentId(): PaymentId
  transferId(): TransferId
}

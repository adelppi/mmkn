import type { GroupAccessDenied } from '../group/access'
import type { Group } from '../group/group'
import { Member } from '../group/member'
import { idEquals, type GroupId, type MemberId, type TransferId, type UserId } from '../id'
import { Money, type MoneyInvalid } from '../money/money'
import { err, ok, type Result } from '../result'
import { requireRecordMember } from './access'
import { plainDate, type PlainDate, type PlainDateInvalid } from './date'

/**
 * 送金（`docs/domain/record.md`「Transfer（送金）」）。
 *
 * **ある Member から別の Member へのお金の移動**を記録する。それ以上の意味を持たない。
 * 「借りの解消」「返金」「立替の返済」を区別せず、特定の Payment とも紐付かない。
 *
 * **清算案の送金（`settlementTransfer`）とは別のもの**（`docs/glossary.md`「名前の付け方」）。
 * 清算案から登録した Transfer も、手で入力したものと区別されない。
 *
 * **「内容」を持たない。** 送金そのものだけを記録し、「なぜ送ったか」を残さない。送金手段も記録しない。
 */
export type Transfer = {
  readonly id: TransferId
  readonly groupId: GroupId
  /** お金を送った Member。 */
  readonly sender: MemberId
  /** お金を受け取った Member。 */
  readonly recipient: MemberId
  /** **1 件の記録は 1 つの通貨だけを持つ**（`docs/domain/money.md`「通貨をまたがない」）。 */
  readonly money: Money
  /** 発生日。時刻を持たず、未来の日付も許す。 */
  readonly occurredOn: PlainDate
  /** この Transfer を登録した User。**何にも使わない**（`docs/domain/record.md`「登録者」）。 */
  readonly recordedBy: UserId
  /** 登録された時点。並び順にだけ使い、**編集で変わらない**。 */
  readonly recordedAt: Date
}

/** 属性が制約を満たさなかったときの失敗。 */
export type TransferInvalid =
  | { kind: 'senderNotMember' }
  | { kind: 'recipientNotMember' }
  | { kind: 'sameSenderAndRecipient' }
  | MoneyInvalid
  | PlainDateInvalid

export type CreateTransferFailure = TransferInvalid
export type EditTransferFailure = GroupAccessDenied | TransferInvalid

/** 編集できる属性。ID・グループ・登録者・登録日時は含まない。 */
type Attributes = {
  sender: MemberId
  recipient: MemberId
  amount: number
  currency: string
  occurredOn: string
}

const isMember = (group: Group, member: MemberId): boolean =>
  Member.byId(group.members, member) !== undefined

type Validated = {
  sender: MemberId
  recipient: MemberId
  money: Money
  occurredOn: PlainDate
}

/**
 * Transfer のルール（`docs/domain/record.md`「ルール」）。
 *
 * 送り手と受け手は**異なる** Member で、どちらもその Transfer が属するグループの Member に限る。
 * **グループ外への送金は扱わない。**
 */
const attributes = (group: Group, input: Attributes): Result<Validated, TransferInvalid> => {
  if (!isMember(group, input.sender)) return err({ kind: 'senderNotMember' })
  if (!isMember(group, input.recipient)) return err({ kind: 'recipientNotMember' })
  if (idEquals(input.sender, input.recipient)) return err({ kind: 'sameSenderAndRecipient' })

  const money = Money.create({ amount: input.amount, currency: input.currency })
  if (!money.ok) return money

  const occurredOn = plainDate(input.occurredOn)
  if (!occurredOn.ok) return occurredOn

  return ok({
    sender: input.sender,
    recipient: input.recipient,
    money: money.value,
    occurredOn: occurredOn.value,
  })
}

/**
 * 送金を記録する。
 *
 * ID と登録日時は受け取るだけで、ここでは作らない（`docs/adr/0008-layer-internals.md`）。
 */
const create = (
  input: {
    id: TransferId
    group: Group
    recordedBy: UserId
    recordedAt: Date
  } & Attributes,
): Result<Transfer, CreateTransferFailure> => {
  const validated = attributes(input.group, input)
  if (!validated.ok) return validated

  return ok({
    id: input.id,
    groupId: input.group.id,
    ...validated.value,
    recordedBy: input.recordedBy,
    recordedAt: input.recordedAt,
  })
}

/**
 * 送金を編集する（`docs/domain/record.md`「編集」）。
 *
 * **過去の Transfer との整合性を検査しない。** 編集後の内容がそのまま現在の記録になる。
 * **登録日時を取り直さない。** ID・グループ・登録者も変わらない。
 */
const edit = (
  transfer: Transfer,
  input: { group: Group; actor: UserId | undefined } & Attributes,
): Result<Transfer, EditTransferFailure> => {
  const member = requireRecordMember(input.group, transfer, input.actor)
  if (!member.ok) return member

  const validated = attributes(input.group, input)
  if (!validated.ok) return validated

  return ok({ ...transfer, ...validated.value })
}

/**
 * Transfer への操作。
 *
 * **削除はここに無い。** 理由は `payment.ts` と同じ。
 */
export const Transfer = { create, edit }

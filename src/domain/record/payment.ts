import type { GroupAccessDenied } from '../group/access'
import type { Group } from '../group/group'
import { Member } from '../group/member'
import type { GroupId, MemberId, PaymentId, UserId } from '../id'
import { Money, type MoneyInvalid } from '../money/money'
import { err, ok, type Result } from '../result'
import { requireRecordMember } from './access'
import { plainDate, type PlainDate, type PlainDateInvalid } from './date'
import { distribute, memberOrder, type Share } from './share'

/**
 * 支払い（`docs/domain/record.md`「Payment（支払い）」）。
 *
 * **グループ外に対して、ある Member が支払ったお金と、その金額を負担する Member** を記録する。
 *
 * Payment と、その負担者をひとまとまりとして扱う（`docs/adr/0008-layer-internals.md`「永続化の単位」）。
 * 楽観ロックの版はここに持たない（`docs/adr/0005-data-access-and-authorization.md`）。
 */
export type Payment = {
  readonly id: PaymentId
  readonly groupId: GroupId
  /** 支払いを行った Member。**登録者とは別のもの**（`docs/glossary.md`「名前の付け方」）。 */
  readonly payer: MemberId
  /**
   * 金額を負担する Member の集合。1 人以上で、同じ Member を重複して含まない。
   *
   * **集合であり、並びは意味を持たない。** 配分順序で正規化してあるため、
   * 同じ負担者を別の順番で入力しても同じ Payment になる。
   */
  readonly bearers: readonly MemberId[]
  /** **1 件の記録は 1 つの通貨だけを持つ**（`docs/domain/money.md`「通貨をまたがない」）。 */
  readonly money: Money
  /** 発生日。時刻を持たず、未来の日付も許す。 */
  readonly occurredOn: PlainDate
  /** 支払いの内容。**任意で、空でもよい。** */
  readonly description: string
  /** この Payment を登録した User。**何にも使わない**（`docs/domain/record.md`「登録者」）。 */
  readonly recordedBy: UserId
  /** 登録された時点。並び順にだけ使い、**編集で変わらない**。 */
  readonly recordedAt: Date
}

/**
 * 内容の上限（`docs/domain/record.md`「Payment（支払い）」）。
 *
 * **この数値をここ以外に書かない**（`CLAUDE.md`）。画面側の入力属性もここから取る。
 */
export const DESCRIPTION_MAX_LENGTH = 100

/** 属性が制約を満たさなかったときの失敗。 */
export type PaymentInvalid =
  | { kind: 'payerNotMember' }
  | { kind: 'bearersEmpty' }
  | { kind: 'bearerDuplicated' }
  | { kind: 'bearerNotMember' }
  | { kind: 'descriptionTooLong' }
  | MoneyInvalid
  | PlainDateInvalid

export type CreatePaymentFailure = PaymentInvalid
export type EditPaymentFailure = GroupAccessDenied | PaymentInvalid

/** 編集できる属性。ID・グループ・登録者・登録日時は含まない。 */
type Attributes = {
  payer: MemberId
  bearers: readonly MemberId[]
  amount: number
  currency: string
  occurredOn: string
  description: string
}

const isMember = (group: Group, member: MemberId): boolean =>
  Member.byId(group.members, member) !== undefined

/**
 * 内容を整える。**前後の空白を落とす。空は許す**（`docs/domain/record.md`）。
 *
 * 長さは符号単位ではなくコードポイントで数える（`src/domain/group/text.ts` と同じ理由）。
 */
const description = (raw: string): Result<string, { kind: 'descriptionTooLong' }> => {
  const trimmed = raw.trim()
  if ([...trimmed].length > DESCRIPTION_MAX_LENGTH) return err({ kind: 'descriptionTooLong' })

  return ok(trimmed)
}

/**
 * 支払者と負担者のルール（`docs/domain/record.md`「支払者と負担者」）。
 *
 * **支払者と負担者は独立している。** 支払者が負担者に含まれてもよいし、含まれなくてもよい。
 */
const bearers = (
  group: Group,
  raw: readonly MemberId[],
): Result<readonly MemberId[], PaymentInvalid> => {
  if (raw.length === 0) return err({ kind: 'bearersEmpty' })
  if (new Set(raw).size !== raw.length) return err({ kind: 'bearerDuplicated' })
  if (!raw.every((bearer) => isMember(group, bearer))) return err({ kind: 'bearerNotMember' })

  return ok([...raw].sort(memberOrder))
}

type Validated = {
  payer: MemberId
  bearers: readonly MemberId[]
  money: Money
  occurredOn: PlainDate
  description: string
}

const attributes = (group: Group, input: Attributes): Result<Validated, PaymentInvalid> => {
  if (!isMember(group, input.payer)) return err({ kind: 'payerNotMember' })

  const validBearers = bearers(group, input.bearers)
  if (!validBearers.ok) return validBearers

  const money = Money.create({ amount: input.amount, currency: input.currency })
  if (!money.ok) return money

  const occurredOn = plainDate(input.occurredOn)
  if (!occurredOn.ok) return occurredOn

  const content = description(input.description)
  if (!content.ok) return content

  return ok({
    payer: input.payer,
    bearers: validBearers.value,
    money: money.value,
    occurredOn: occurredOn.value,
    description: content.value,
  })
}

/**
 * 支払いを記録する。
 *
 * ID と登録日時は受け取るだけで、ここでは作らない（`docs/adr/0008-layer-internals.md`）。
 */
const create = (
  input: {
    id: PaymentId
    group: Group
    recordedBy: UserId
    recordedAt: Date
  } & Attributes,
): Result<Payment, CreatePaymentFailure> => {
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
 * 支払いを編集する（`docs/domain/record.md`「編集」）。
 *
 * 前提条件は「操作する User が、その記録の属するグループの Member であること」。
 * **グループの Member であれば、他の Member が登録した記録も編集できる。**
 *
 * 編集できる属性はすべて渡す。渡された内容がそのまま現在の記録になり、**編集前の内容は残らない。**
 *
 * **登録日時を取り直さない**（`docs/domain/record.md`「記録の並び」）。記録を直しても
 * 一覧での位置は動かない。ID・グループ・登録者も変わらない。
 */
const edit = (
  payment: Payment,
  input: { group: Group; actor: UserId | undefined } & Attributes,
): Result<Payment, EditPaymentFailure> => {
  const member = requireRecordMember(input.group, payment, input.actor)
  if (!member.ok) return member

  const validated = attributes(input.group, input)
  if (!validated.ok) return validated

  return ok({ ...payment, ...validated.value })
}

/**
 * 負担額の配分（`docs/domain/record.md`「負担額の配分」）。
 *
 * 保存せず、必要になるたびに金額と負担者から導出する。**同じ Payment からは常に同じ配分になる。**
 */
const shares = (payment: Payment): readonly Share[] =>
  distribute(payment.money.amount, payment.bearers)

/**
 * Payment への操作。
 *
 * **削除はここに無い。** 削除は状態の遷移を持たず（記録が完全に存在しなくなるだけ）、
 * ドメインが担うのは認可の判定だけである（`access.ts` の `requireRecordMember`）。
 */
export const Payment = { create, edit, shares }

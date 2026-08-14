import type { Group } from '../../../domain/group/group'
import { Member } from '../../../domain/group/member'
import { toMemberId, toUserId } from '../../../domain/id'
import { currency as toCurrency, minorUnitOf, type Currency } from '../../../domain/money/currency'
import { MONEY_MAX_AMOUNT } from '../../../domain/money/money'
import { DESCRIPTION_MAX_LENGTH, Payment } from '../../../domain/record/payment'
import type { AnyRecord } from '../../../domain/record/record'
import type { Transfer } from '../../../domain/record/transfer'
import type { Result } from '../../../domain/result'
import type { ListRecordsError, ListRecordsOutput } from '../../../usecase/record/list-records'
import type { Versioned } from '../../../usecase/usecase'
import { amountText, moneyText, type MoneyText } from '../../shared/money'
import type { AmountFieldLimits, TextFieldLimits } from './form'
import { toCurrencyOptions, type CurrencyOptionView } from './group'
import { messageOf, type FailureTag } from './message'
import { route } from './route'

/**
 * 記録（支払いと送金）の表示（`docs/features.md` #5〜#7）。
 *
 * **Payment と Transfer をまとめて 1 つの列として扱う**（`docs/domain/record.md`「記録の並び」）。
 * 並び自体はユースケースが済ませてあるため、ここが行うのは日付ごとの束ねと整形だけである。
 */

const isPayment = (record: AnyRecord): record is Payment => 'bearers' in record

const displayNameOf = (group: Group, memberId: string): string =>
  Member.byId(group.members, toMemberId(memberId))?.displayName ?? '（不明）'

/** 登録者は User。**その Group の Member として表示する**（記録が指す先は Member）。 */
const recordedByName = (group: Group, userId: string): string =>
  Member.byUser(group.members, toUserId(userId))?.displayName ?? '（不明）'

/** 内容が空の Payment を一覧で何と出すかは画面側の問題（`docs/domain/record.md`）。 */
const NO_DESCRIPTION = '（内容なし）'

// ── 記録一覧 ──────────────────────────────────────────────────────────────────

export type RecordRowView = {
  readonly id: string
  readonly type: 'payment' | 'transfer'
  readonly title: string
  readonly detail: string
  readonly money: MoneyText
  readonly href: string
}

export type RecordDayView = {
  readonly occurredOn: string
  readonly label: string
  readonly rows: readonly RecordRowView[]
}

export type RecordListView =
  | {
      readonly kind: 'ok'
      readonly days: readonly RecordDayView[]
      readonly newRecordHref: string
    }
  | { readonly kind: 'empty'; readonly message: string; readonly newRecordHref: string }
  | {
      readonly kind: 'notAuthenticated' | 'notFound' | 'notMember'
      readonly message: string
      readonly groupsHref: string
    }

/**
 * 発生日の見出し。
 *
 * **`Date` を経由しない**（`docs/domain/record.md`「発生日」：日付は時刻もタイムゾーンも持たない）。
 * 一度でも時点に直すと、入力された日付が別の日付として読み替えられる経路ができる。
 *
 * 年は、一覧の中で最も新しい記録と違うときだけ出す。
 */
const dayLabel = (occurredOn: string, currentYear: string): string => {
  const [year = '', month = '', day = ''] = occurredOn.split('-')
  const withoutYear = `${Number(month)}月${Number(day)}日`

  return year === currentYear ? withoutYear : `${year}年${withoutYear}`
}

const toRow = (group: Group, versioned: Versioned<AnyRecord>): RecordRowView => {
  const record = versioned.record

  if (isPayment(record)) {
    return {
      id: record.id,
      type: 'payment',
      title: record.description === '' ? NO_DESCRIPTION : record.description,
      detail: `${displayNameOf(group, record.payer)} が支払い ・ ${record.bearers.length} 人分`,
      money: moneyText(record.money.amount, record.money.currency),
      href: route.record(group.id, record.id),
    }
  }

  return {
    id: record.id,
    type: 'transfer',
    title: `${displayNameOf(group, record.sender)} → ${displayNameOf(group, record.recipient)}`,
    detail: '送金',
    money: moneyText(record.money.amount, record.money.currency),
    href: route.record(group.id, record.id),
  }
}

export const toRecordListView = (
  result: Result<ListRecordsOutput, ListRecordsError>,
): RecordListView => {
  if (!result.ok) {
    return { kind: result.error.kind, message: messageOf(result.error), groupsHref: route.groups() }
  }

  const { group, records } = result.value
  const newRecordHref = route.newRecord(group.id)

  if (records.length === 0) {
    return {
      kind: 'empty',
      message: 'まだ記録がありません。最初の支払いを記録すると、ここに並びます。',
      newRecordHref,
    }
  }

  // 並びはユースケースが済ませてある（発生日の新しい順）。先頭の年を基準にする。
  const currentYear = records[0]?.record.occurredOn.split('-')[0] ?? ''

  // **並びは崩さない。** 隣り合う同じ発生日をまとめるだけで、並べ替えはしない。
  const days: { occurredOn: string; label: string; rows: RecordRowView[] }[] = []
  for (const versioned of records) {
    const occurredOn = versioned.record.occurredOn
    let last = days.at(-1)

    if (last === undefined || last.occurredOn !== occurredOn) {
      last = { occurredOn, label: dayLabel(occurredOn, currentYear), rows: [] }
      days.push(last)
    }

    last.rows.push(toRow(group, versioned))
  }

  return { kind: 'ok', days, newRecordHref }
}

// ── 記録の登録・編集 ──────────────────────────────────────────────────────────

export type MemberOptionView = {
  readonly id: string
  readonly displayName: string
}

export type RecordFormFields = {
  readonly type: 'payment' | 'transfer'
  readonly groupId: string
  /** 編集のときだけ入る。登録では空文字。 */
  readonly recordId: string
  /** 操作者が見ていた版（`docs/adr/0005`）。登録では空文字。 */
  readonly version: string
  readonly amount: string
  readonly amountLimits: AmountFieldLimits
  readonly currency: string
  readonly currencies: readonly CurrencyOptionView[]
  readonly members: readonly MemberOptionView[]
  readonly payer: string
  readonly bearers: readonly string[]
  readonly sender: string
  readonly recipient: string
  readonly occurredOn: string
  readonly description: string
  readonly descriptionLimits: TextFieldLimits
  readonly submitLabel: string
  readonly cancelHref: string
}

/**
 * 金額の入力属性（`docs/adr/0009`「クライアント側の入力検査」）。
 *
 * **数値はドメイン層の定数から取る。** 上限は「その通貨の最小単位で `MONEY_MAX_AMOUNT`」
 * （`docs/domain/money.md`）であり、それを人が打つ表記に直したものをここに入れる。
 *
 * **選ばれている通貨についての値である。** 送信せずに通貨を切り替えると、ブラウザ側の上限は
 * 一時的にずれる。**判定の正はドメイン層 1 か所だけ**なので、ずれても結論は変わらない。
 */
const amountLimitsOf = (currency: Currency): AmountFieldLimits => {
  const minorUnit = minorUnitOf(currency)

  return {
    max: amountText(MONEY_MAX_AMOUNT, currency),
    step: minorUnit === 0 ? '1' : `0.${'0'.repeat(minorUnit - 1)}1`,
    required: true,
  }
}

const memberOptions = (group: Group): readonly MemberOptionView[] =>
  group.members.map((member) => ({ id: member.id, displayName: member.displayName }))

/** その Group の記録に現れた通貨（入力候補の絞り込みに使う。`docs/domain/money.md`）。 */
export const recordedCurrenciesOf = (
  records: readonly Versioned<AnyRecord>[],
): readonly Currency[] => [...new Set(records.map((it) => it.record.money.currency))]

export type RecordFormInput = {
  readonly type: 'payment' | 'transfer'
  readonly recordId?: string
  readonly version?: number
  readonly amount?: string
  readonly currency?: string
  readonly payer?: string
  readonly bearers?: readonly string[]
  readonly sender?: string
  readonly recipient?: string
  readonly occurredOn?: string
  readonly description?: string
}

export const recordFormFields = (
  group: Group,
  recorded: readonly Currency[],
  input: RecordFormInput,
): RecordFormFields => {
  const selected = input.currency ?? group.defaultCurrency
  // 表に無い通貨コードが送り返されてきたときは、上限だけ既定通貨のもので出す。
  // **通貨そのものが扱えるかの判定はドメイン層が行う**（ここでは弾かず、そのまま入力欄に戻す）。
  const known = toCurrency(selected)

  return {
    type: input.type,
    groupId: group.id,
    recordId: input.recordId ?? '',
    version: input.version === undefined ? '' : String(input.version),
    amount: input.amount ?? '',
    amountLimits: amountLimitsOf(known.ok ? known.value : group.defaultCurrency),
    currency: selected,
    currencies: toCurrencyOptions(recorded),
    members: memberOptions(group),
    payer: input.payer ?? '',
    bearers: input.bearers ?? [],
    sender: input.sender ?? '',
    recipient: input.recipient ?? '',
    occurredOn: input.occurredOn ?? '',
    description: input.description ?? '',
    descriptionLimits: { maxLength: DESCRIPTION_MAX_LENGTH, required: false },
    submitLabel: input.recordId === undefined ? '記録する' : '保存する',
    cancelHref: route.group(group.id),
  }
}

/**
 * 送られてきた入力を、いまのフォームの状態に重ねる。
 *
 * **入力欄の中身はサーバーが返したものが正である**（`docs/adr/0009`「フォーム」）。
 * 失敗して戻すときも、打った内容をそのまま返す。通貨が変わっていれば入力属性も取り直す。
 */
export const withSubmitted = (
  base: RecordFormFields,
  values: {
    readonly type: 'payment' | 'transfer'
    readonly amount: string
    readonly currency: string
    readonly payer: string
    readonly bearers: readonly string[]
    readonly sender: string
    readonly recipient: string
    readonly occurredOn: string
    readonly description: string
  },
): RecordFormFields => {
  const known = toCurrency(values.currency)

  return {
    ...base,
    ...values,
    amountLimits: amountLimitsOf(known.ok ? known.value : toCurrencyFallback(base)),
  }
}

/** 通貨が読めないときに入力属性の基準にする通貨。**判定には使わない。** */
const toCurrencyFallback = (base: RecordFormFields): Currency => {
  const known = toCurrency(base.currency)
  if (known.ok) return known.value

  // 通貨表に必ずある通貨で桁を決める。ここまで来るのは、扱えない通貨コードが
  // 2 つ続けて送られてきた場合だけで、判定はドメイン層がその後に行う。
  const fallback = toCurrency('JPY')
  if (!fallback.ok) throw new RangeError('通貨表が空である')
  return fallback.value
}

/**
 * 選択肢を持たないフォーム。
 *
 * **直前の状態が無いときにだけ使う。** 通常は Server Action が受け取った直前の状態から
 * メンバーと通貨の選択肢を引き継ぐ。
 */
export const emptyRecordForm = (
  groupId: string,
  type: 'payment' | 'transfer',
): RecordFormFields => {
  const jpy = toCurrency('JPY')
  if (!jpy.ok) throw new RangeError('通貨表が空である')

  return {
    type,
    groupId,
    recordId: '',
    version: '',
    amount: '',
    amountLimits: amountLimitsOf(jpy.value),
    currency: jpy.value,
    currencies: [],
    members: [],
    payer: '',
    bearers: [],
    sender: '',
    recipient: '',
    occurredOn: '',
    description: '',
    descriptionLimits: { maxLength: DESCRIPTION_MAX_LENGTH, required: false },
    submitLabel: '記録する',
    cancelHref: route.group(groupId),
  }
}

export type RecordFormView =
  | { readonly kind: 'input'; readonly form: RecordFormFields }
  | { readonly kind: 'invalid'; readonly form: RecordFormFields; readonly message: string }
  | { readonly kind: 'saved'; readonly form: RecordFormFields; readonly redirectTo: string }
  | {
      /** **後から届いた変更は失敗する**（`docs/domain/record.md`「同じ記録に同時に手が入ったとき」）。 */
      readonly kind: 'conflict'
      readonly form: RecordFormFields
      readonly message: string
      readonly reloadHref: string
    }
  | {
      readonly kind: 'denied'
      readonly message: string
      readonly groupsHref: string
    }

export const initialRecordFormView = (form: RecordFormFields): RecordFormView => ({
  kind: 'input',
  form,
})

/**
 * 登録の初期状態（`docs/adr/0009-web-ui.md`「フォーム」：初期状態も Presenter が持つ）。
 *
 * **読めなかった場合もここでタグにする。** Container が成功と失敗で分岐しないようにするため、
 * 記録の一覧と同じ結果を受け取って、そのままフォームか失敗かを返す。
 */
export const toNewRecordFormView = (
  result: Result<ListRecordsOutput, ListRecordsError>,
): RecordFormView => {
  if (!result.ok) {
    return { kind: 'denied', message: messageOf(result.error), groupsHref: route.groups() }
  }

  return initialRecordFormView(
    recordFormFields(result.value.group, recordedCurrenciesOf(result.value.records), {
      type: 'payment',
    }),
  )
}

/** 編集の初期状態。**記録が見つからない場合も、詳細と同じ扱いになる。** */
export const toEditRecordFormView = (
  recordId: string,
  result: Result<ListRecordsOutput, ListRecordsError>,
): RecordFormView => {
  const detail = toRecordDetailView(recordId, result)

  return detail.kind === 'ok'
    ? initialRecordFormView(detail.form)
    : { kind: 'denied', message: detail.message, groupsHref: detail.groupsHref }
}

/**
 * 登録・編集・削除の結果をビューモデルに直す。
 *
 * **競合と、前提条件を満たさなかったときだけ別のタグにする。** 入力の不備はすべて `invalid` に
 * 集め、フォームに戻す。案内すべきことが違う（やり直す先が違う）ためである。
 */
export const toRecordFormView = (
  form: RecordFormFields,
  result: Result<unknown, { readonly kind: FailureTag }>,
): RecordFormView => {
  if (result.ok) {
    return { kind: 'saved', form, redirectTo: route.group(form.groupId) }
  }

  const kind = result.error.kind

  if (kind === 'versionConflict') {
    return {
      kind: 'conflict',
      form,
      message: messageOf(result.error),
      reloadHref: route.record(form.groupId, form.recordId),
    }
  }

  if (kind === 'notAuthenticated' || kind === 'notFound' || kind === 'notMember') {
    return { kind: 'denied', message: messageOf(result.error), groupsHref: route.groups() }
  }

  return { kind: 'invalid', form, message: messageOf(result.error) }
}

// ── 記録の詳細 ────────────────────────────────────────────────────────────────

export type ShareView = {
  readonly displayName: string
  readonly money: MoneyText
}

export type RecordDetailView =
  | {
      readonly kind: 'ok'
      readonly title: string
      readonly money: MoneyText
      readonly currency: string
      readonly description: string
      readonly occurredOn: string
      readonly recordedBy: string
      /** 支払いのときだけ入る。**保存せず、金額と負担者から導出する**（`docs/domain/record.md`）。 */
      readonly shares: readonly ShareView[]
      readonly payerName: string
      readonly transferNames: { readonly sender: string; readonly recipient: string } | undefined
      readonly form: RecordFormFields
      readonly groupHref: string
    }
  | {
      readonly kind: 'notAuthenticated' | 'notFound' | 'notMember'
      readonly message: string
      readonly groupsHref: string
    }

const transferOf = (record: AnyRecord): Transfer | undefined =>
  isPayment(record) ? undefined : record

export const toRecordDetailView = (
  recordId: string,
  result: Result<ListRecordsOutput, ListRecordsError>,
): RecordDetailView => {
  if (!result.ok) {
    return { kind: result.error.kind, message: messageOf(result.error), groupsHref: route.groups() }
  }

  const { group, records } = result.value
  const found = records.find((it) => it.record.id === recordId)

  // **他のグループの記録を指した場合も「見つからない」**（`docs/domain/record.md`「境界・例外ケース」）。
  if (found === undefined) {
    return {
      kind: 'notFound',
      message: messageOf({ kind: 'notFound' }),
      groupsHref: route.groups(),
    }
  }

  const record = found.record
  const recorded = recordedCurrenciesOf(records)
  const payment = isPayment(record) ? record : undefined
  const transfer = transferOf(record)

  return {
    kind: 'ok',
    title: payment === undefined ? '送金の詳細' : '支払いの詳細',
    money: moneyText(record.money.amount, record.money.currency),
    currency: record.money.currency,
    description: payment === undefined ? '' : payment.description,
    occurredOn: record.occurredOn,
    recordedBy: recordedByName(group, record.recordedBy),
    shares:
      payment === undefined
        ? []
        : Payment.shares(payment).map((share) => ({
            displayName: displayNameOf(group, share.bearer),
            money: moneyText(share.amount, record.money.currency),
          })),
    payerName: payment === undefined ? '' : displayNameOf(group, payment.payer),
    transferNames:
      transfer === undefined
        ? undefined
        : {
            sender: displayNameOf(group, transfer.sender),
            recipient: displayNameOf(group, transfer.recipient),
          },
    form: recordFormFields(group, recorded, {
      type: payment === undefined ? 'transfer' : 'payment',
      recordId: record.id,
      version: found.version,
      amount: amountText(record.money.amount, record.money.currency),
      currency: record.money.currency,
      payer: payment?.payer ?? '',
      bearers: payment?.bearers ?? [],
      sender: transfer?.sender ?? '',
      recipient: transfer?.recipient ?? '',
      occurredOn: record.occurredOn,
      description: payment?.description ?? '',
    }),
    groupHref: route.group(group.id),
  }
}

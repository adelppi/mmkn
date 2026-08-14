import {
  toGroupId,
  toMemberId,
  toPaymentId,
  toTransferId,
  type UserId,
} from '../../../domain/id'
import { currency as toCurrency } from '../../../domain/money/currency'
import type { Payment } from '../../../domain/record/payment'
import type { Transfer } from '../../../domain/record/transfer'
import type {
  DeletePaymentError,
  DeletePaymentInput,
} from '../../../usecase/record/delete-payment'
import type {
  DeleteTransferError,
  DeleteTransferInput,
} from '../../../usecase/record/delete-transfer'
import type { EditPaymentError, EditPaymentInput } from '../../../usecase/record/edit-payment'
import type { EditTransferError, EditTransferInput } from '../../../usecase/record/edit-transfer'
import type {
  RegisterPaymentError,
  RegisterPaymentInput,
} from '../../../usecase/record/register-payment'
import type {
  RegisterTransferError,
  RegisterTransferInput,
} from '../../../usecase/record/register-transfer'
import type { UseCase, Versioned } from '../../../usecase/usecase'
import { parseAmount } from '../../shared/money'
import { field, fields } from '../presenter/form'
import {
  emptyRecordForm,
  toRecordFormView,
  withSubmitted,
  type RecordFormFields,
  type RecordFormView,
} from '../presenter/record'

/**
 * 記録への操作（`docs/features.md` #5〜#7）。
 *
 * **入力の変換だけを行う。** 支払者と負担者の関係も、金額の上限も、発生日の妥当性も見ない。
 * すべてドメイン層が判定し、失敗はビューモデルのタグとして戻る（`docs/adr/0009-web-ui.md`）。
 *
 * 支払いと送金を 1 つの入口にまとめてあるのは、**画面が 1 枚のフォームで両方を扱うため**
 * （上部の切り替えで選ぶ）。**振る舞いはどちらもそれぞれのユースケースがそのまま担う。**
 */

export type RecordUseCases = {
  registerPayment: UseCase<RegisterPaymentInput, Versioned<Payment>, RegisterPaymentError>
  editPayment: UseCase<EditPaymentInput, Versioned<Payment>, EditPaymentError>
  deletePayment: UseCase<DeletePaymentInput, void, DeletePaymentError>
  registerTransfer: UseCase<RegisterTransferInput, Versioned<Transfer>, RegisterTransferError>
  editTransfer: UseCase<EditTransferInput, Versioned<Transfer>, EditTransferError>
  deleteTransfer: UseCase<DeleteTransferInput, void, DeleteTransferError>
}

/** 直前の状態から、選択肢を含むフォームの形を引き継ぐ。 */
const baseFormOf = (previous: RecordFormView, data: FormData): RecordFormFields =>
  'form' in previous
    ? previous.form
    : emptyRecordForm(
        field(data, 'groupId'),
        field(data, 'type') === 'transfer' ? 'transfer' : 'payment',
      )

const submittedForm = (previous: RecordFormView, data: FormData): RecordFormFields =>
  withSubmitted(baseFormOf(previous, data), {
    type: field(data, 'type') === 'transfer' ? 'transfer' : 'payment',
    amount: field(data, 'amount'),
    currency: field(data, 'currency'),
    payer: field(data, 'payer'),
    bearers: fields(data, 'bearers'),
    sender: field(data, 'sender'),
    recipient: field(data, 'recipient'),
    occurredOn: field(data, 'occurredOn'),
    description: field(data, 'description'),
  })

/**
 * 打たれた金額を、その通貨の最小単位を 1 とした整数にする。
 *
 * **読めなかったものを 0 で埋めない。** `NaN` のまま渡し、ドメイン層に「金額として成立しない」と
 * 判定させる（`docs/domain/money.md`「金額の表し方」）。**扱えない通貨も同じで、ここでは弾かない。**
 */
const amountOf = (form: RecordFormFields): number => {
  const known = toCurrency(form.currency)
  if (!known.ok) return Number.NaN

  return parseAmount(form.amount, known.value) ?? Number.NaN
}

const versionOf = (form: RecordFormFields): number => Number(form.version)

/**
 * 記録を保存する。**登録か編集かは、フォームが記録の識別子を持っているかで決まる。**
 *
 * 編集では、**操作者が見ていた版**をそのまま渡す（`docs/adr/0005`）。読み直した版ではない。
 */
export const saveRecord =
  (deps: RecordUseCases & { actor: UserId | undefined }) =>
  async (previous: RecordFormView, data: FormData): Promise<RecordFormView> => {
    const form = submittedForm(previous, data)
    const group = toGroupId(form.groupId)
    const common = { actor: deps.actor, group, amount: amountOf(form), currency: form.currency }

    if (form.type === 'payment') {
      const payment = {
        ...common,
        payer: toMemberId(form.payer),
        bearers: form.bearers.map(toMemberId),
        occurredOn: form.occurredOn,
        description: form.description,
      }

      return toRecordFormView(
        form,
        form.recordId === ''
          ? await deps.registerPayment(payment)
          : await deps.editPayment({
              ...payment,
              payment: toPaymentId(form.recordId),
              version: versionOf(form),
            }),
      )
    }

    const transfer = {
      ...common,
      sender: toMemberId(form.sender),
      recipient: toMemberId(form.recipient),
      occurredOn: form.occurredOn,
    }

    return toRecordFormView(
      form,
      form.recordId === ''
        ? await deps.registerTransfer(transfer)
        : await deps.editTransfer({
            ...transfer,
            transfer: toTransferId(form.recordId),
            version: versionOf(form),
          }),
    )
  }

/**
 * 記録を削除する。**削除履歴を残さず、復元もできない**（`docs/domain/record.md`「削除」）。
 *
 * 版が変わっていれば失敗する。**自動でやり直さない**（`docs/adr/0005`）。
 */
export const deleteRecord =
  (deps: RecordUseCases & { actor: UserId | undefined }) =>
  async (previous: RecordFormView, data: FormData): Promise<RecordFormView> => {
    const form = submittedForm(previous, data)
    const target = {
      actor: deps.actor,
      group: toGroupId(form.groupId),
      version: versionOf(form),
    }

    return toRecordFormView(
      form,
      form.type === 'payment'
        ? await deps.deletePayment({ ...target, payment: toPaymentId(form.recordId) })
        : await deps.deleteTransfer({ ...target, transfer: toTransferId(form.recordId) }),
    )
  }

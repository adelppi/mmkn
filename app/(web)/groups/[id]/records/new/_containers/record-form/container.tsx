import { readRecords } from '@/app/_lib/read'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import type { NoticeView } from '@/src/adapter/web/presenter/notice'
import {
  toEditRecordFormView,
  toNewRecordFormView,
  type RecordFormView,
} from '@/src/adapter/web/presenter/record'
import { RecordFormPresentation } from './presentation'

/**
 * 記録の登録と編集（設計 06・07・08）。違うのは初期状態が空か既存の記録かだけである。
 *
 * メンバーの選択肢と入力候補に出す通貨を、記録の一覧と同じ取得から得る。
 */
export async function RecordFormContainer({
  groupId,
  recordId,
  action,
  unreachable,
}: {
  readonly groupId: string
  /** 渡すと編集になる。**操作者が見ていた版も、ここから入る。** */
  readonly recordId?: string
  readonly action: FormAction<RecordFormView>
  readonly unreachable: NoticeView
}) {
  const listed = await readRecords(groupId)

  const view =
    recordId === undefined ? toNewRecordFormView(listed) : toEditRecordFormView(recordId, listed)

  return <RecordFormPresentation {...view} action={action} unreachable={unreachable} />
}

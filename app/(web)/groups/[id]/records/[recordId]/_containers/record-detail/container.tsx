import { readRecords } from '@/app/_lib/read'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import type { NoticeView } from '@/src/adapter/web/presenter/notice'
import {
  emptyRecordForm,
  initialRecordFormView,
  toRecordDetailView,
  type RecordFormView,
} from '@/src/adapter/web/presenter/record'
import { route } from '@/src/adapter/web/presenter/route'
import { RecordDetailPresentation } from './presentation'

/**
 * 記録の詳細（設計 08）。
 *
 * **記録の一覧と同じ取得から引く。** 1 件だけを読む経路を別に作らないのは、
 * 同じリクエストの中で一覧も読まれるためである（`app/_lib/read.ts` が束ねる）。
 */
export async function RecordDetailContainer({
  groupId,
  recordId,
  deleteAction,
  unreachable,
}: {
  readonly groupId: string
  readonly recordId: string
  readonly deleteAction: FormAction<RecordFormView>
  readonly unreachable: NoticeView
}) {
  return (
    <RecordDetailPresentation
      {...toRecordDetailView(recordId, await readRecords(groupId))}
      deleteAction={deleteAction}
      deleteInitial={initialRecordFormView(emptyRecordForm(groupId, 'payment'))}
      editHref={`${route.record(groupId, recordId)}/edit`}
      unreachable={unreachable}
    />
  )
}

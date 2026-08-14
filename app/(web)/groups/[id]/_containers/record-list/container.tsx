import { readRecords } from '@/app/_lib/read'
import { toRecordListView } from '@/src/adapter/web/presenter/record'
import { RecordListPresentation } from './presentation'

/** 記録一覧（設計 03）。**読み取りもユースケースを通す。** */
export async function RecordListContainer({ groupId }: { readonly groupId: string }) {
  return <RecordListPresentation {...toRecordListView(await readRecords(groupId))} />
}

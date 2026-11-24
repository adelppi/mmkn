import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { unreachableNotice } from '@/src/adapter/web/presenter/notice'
import { saveRecordAction } from '../../new/actions'
import { RecordFormContainer } from '../../new/_containers/record-form/container'

/** 記録の編集（設計 08 の「編集」）。登録と同じ Container を使う。 */
export default async function EditRecordPage({
  params,
}: PageProps<'/groups/[id]/records/[recordId]/edit'>) {
  const { id, recordId } = await params

  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <RecordFormContainer
        groupId={id}
        recordId={recordId}
        action={saveRecordAction}
        unreachable={unreachableNotice()}
      />
    </Suspense>
  )
}

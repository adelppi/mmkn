import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { unreachableNotice } from '@/src/adapter/web/presenter/notice'
import { deleteRecordAction } from '../new/actions'
import { RecordDetailContainer } from './_containers/record-detail/container'

export default async function RecordPage({
  params,
}: PageProps<'/groups/[id]/records/[recordId]'>) {
  const { id, recordId } = await params

  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <RecordDetailContainer
        groupId={id}
        recordId={recordId}
        deleteAction={deleteRecordAction}
        unreachable={unreachableNotice()}
      />
    </Suspense>
  )
}

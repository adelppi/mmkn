import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { saveRecordAction } from './actions'
import { RecordFormContainer } from './_containers/record-form/container'

export default async function NewRecordPage({ params }: PageProps<'/groups/[id]/records/new'>) {
  const { id } = await params

  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <RecordFormContainer groupId={id} action={saveRecordAction} />
    </Suspense>
  )
}

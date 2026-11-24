import { Suspense } from 'react'

import { single } from '@/app/_lib/search-param'
import { RowsSkeleton } from '@/app/_ui/skeleton'
import { Announce } from '@/app/_ui/toast'
import { NOTICE_PARAM, toNoticeView } from '@/src/adapter/web/presenter/notice'
import { RecordListContainer } from './_containers/record-list/container'

/** 記録一覧（設計 03）。上端は `layout.tsx` が持つ。 */
export default async function GroupPage({ params, searchParams }: PageProps<'/groups/[id]'>) {
  const { id } = await params
  const notice = toNoticeView(single((await searchParams)[NOTICE_PARAM]))

  return (
    <>
      <Announce notice={notice} clears={NOTICE_PARAM} />

      <Suspense fallback={<RowsSkeleton />}>
        <RecordListContainer groupId={id} />
      </Suspense>
    </>
  )
}

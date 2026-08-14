import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { GroupHeaderContainer } from './_containers/group-header/container'
import { RecordListContainer } from './_containers/record-list/container'
import { ViewerBalanceContainer } from './_containers/viewer-balance/container'

/**
 * 記録一覧（設計 03）。
 *
 * **Container をデータ取得の単位で分け、ここでは境界ごとに並べる**
 * （`docs/adr/0009-web-ui.md`「Container の粒度」）。上端は Group だけを、
 * あなたの収支と記録一覧はそれぞれ記録の全件を読む。
 */
export default async function GroupPage({ params }: PageProps<'/groups/[id]'>) {
  const { id } = await params

  return (
    <Screen>
      <Suspense fallback={<div className="h-32 animate-pulse bg-muted/40" />}>
        <GroupHeaderContainer groupId={id} current="records" />
      </Suspense>

      <Suspense fallback={<div className="mx-4 mt-4 h-24 animate-pulse rounded-lg bg-muted" />}>
        <ViewerBalanceContainer groupId={id} />
      </Suspense>

      <Suspense fallback={<div className="mt-6 h-48 animate-pulse bg-muted/40" />}>
        <RecordListContainer groupId={id} />
      </Suspense>
    </Screen>
  )
}

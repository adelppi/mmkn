import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { GroupListContainer } from './_containers/group-list/container'

/**
 * 入口（設計 02）。
 *
 * **Container はデータ取得の単位で分け、`page.tsx` では境界ごとに並べる**
 * （`docs/adr/0009-web-ui.md`「Container の粒度」）。
 */
export default function GroupsPage() {
  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <GroupListContainer />
    </Suspense>
  )
}

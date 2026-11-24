import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { GroupListContainer } from './_containers/group-list/container'

/** 入口（設計 02）。 */
export default function GroupsPage() {
  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <GroupListContainer />
    </Suspense>
  )
}

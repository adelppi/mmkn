import type { ReactNode } from 'react'

import { readGroup } from '@/app/_lib/read'
import { toGroupHeaderView } from '@/src/adapter/web/presenter/group'
import { GroupHeaderPresentation } from './presentation'

/** グループの上端（設計 03〜05 に共通）。**記録の全件を読まない。** */
export async function GroupHeaderContainer({
  groupId,
  children,
}: {
  readonly groupId: string
  readonly children?: ReactNode
}) {
  return (
    <GroupHeaderPresentation {...toGroupHeaderView(await readGroup(groupId))}>
      {children}
    </GroupHeaderPresentation>
  )
}

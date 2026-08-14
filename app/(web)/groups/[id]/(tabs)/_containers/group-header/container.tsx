import type { ReactNode } from 'react'

import { readGroup } from '@/app/_lib/read'
import { toGroupHeaderView } from '@/src/adapter/web/presenter/group'
import { GroupHeaderPresentation } from './presentation'

/**
 * グループの上端（設計 03〜05 に共通）。
 *
 * **記録の全件を読まない。** 名前とタブだけを出すため、Group の取得だけで足りる。
 * 記録を読む Container とは別に分けてあるのは、そこが最も重い取得だからである
 * （`docs/adr/0009-web-ui.md`「Container の粒度」）。
 *
 * **タブの切り替えではここを通らない。** 上端は 3 つのタブで共有する `layout.tsx` にあり、
 * 切り替えのたびに取り直されない（同「上端を共有する」）。
 */
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

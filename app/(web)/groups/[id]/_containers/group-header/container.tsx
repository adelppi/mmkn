import { readGroup } from '@/app/_lib/read'
import { toGroupHeaderView, type GroupTab } from '@/src/adapter/web/presenter/group'
import { GroupHeaderPresentation } from './presentation'

/**
 * グループの上端（設計 03〜05 に共通）。
 *
 * **記録の全件を読まない。** 名前とタブだけを出すため、Group の取得だけで足りる。
 * 記録を読む Container とは別に分けてあるのは、そこが最も重い取得だからである
 * （`docs/adr/0009-web-ui.md`「Container の粒度」）。
 */
export async function GroupHeaderContainer({
  groupId,
  current,
}: {
  readonly groupId: string
  readonly current: GroupTab
}) {
  return <GroupHeaderPresentation {...toGroupHeaderView(current, await readGroup(groupId))} />
}

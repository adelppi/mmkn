import { readGroups } from '@/app/_lib/read'
import { toGroupListView } from '@/src/adapter/web/presenter/group'
import { GroupListPresentation } from './presentation'

/** グループ一覧（設計 02）。 */
export async function GroupListContainer() {
  return <GroupListPresentation {...toGroupListView(await readGroups())} />
}

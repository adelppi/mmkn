import { readGroups } from '@/app/_lib/read'
import { toGroupListView } from '@/src/adapter/web/presenter/group'
import { GroupListPresentation } from './presentation'

/**
 * グループ一覧（設計 02）。
 *
 * **読み取りもユースケースを通す**（`docs/adr/0005-data-access-and-authorization.md`）。
 * **成功と失敗で分岐しない**（`docs/adr/0009-web-ui.md`）。失敗は Presenter がタグにする。
 */
export async function GroupListContainer() {
  return <GroupListPresentation {...toGroupListView(await readGroups())} />
}

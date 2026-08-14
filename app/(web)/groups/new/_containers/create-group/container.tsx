import type { FormAction } from '@/src/adapter/web/presenter/form'
import { initialCreateGroupView, type CreateGroupView } from '@/src/adapter/web/presenter/group'
import { route } from '@/src/adapter/web/presenter/route'
import { CreateGroupPresentation } from './presentation'

/** 既定通貨の初期値。**扱える通貨を絞るものではない**（`docs/domain/group.md`）。 */
const INITIAL_CURRENCY = 'JPY'

/**
 * グループ作成（設計 09）。
 *
 * **初期状態も Presenter が持つ**（`docs/adr/0009-web-ui.md`「フォーム」）。
 */
export async function CreateGroupContainer({
  action,
}: {
  readonly action: FormAction<CreateGroupView>
}) {
  return (
    <CreateGroupPresentation
      {...initialCreateGroupView(INITIAL_CURRENCY)}
      action={action}
      groupsHref={route.groups()}
    />
  )
}

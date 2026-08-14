'use server'

import { navigate, scope } from '@/app/_lib/action'
import { createGroup } from '@/src/adapter/web/controller/group'
import type { CreateGroupView } from '@/src/adapter/web/presenter/group'

/** グループを作成する（`docs/domain/group.md`「グループを作成する」）。 */
export async function createGroupAction(previous: CreateGroupView, data: FormData) {
  const { usecases, actor } = await scope()

  return navigate(await createGroup({ createGroup: usecases.createGroup, actor })(previous, data))
}

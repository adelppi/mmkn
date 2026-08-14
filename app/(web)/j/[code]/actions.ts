'use server'

import { navigate, scope } from '@/app/_lib/action'
import { joinGroup } from '@/src/adapter/web/controller/group'
import type { JoinView } from '@/src/adapter/web/presenter/group'

/** グループに参加する（`docs/domain/group.md`「グループに参加する」）。 */
export async function joinGroupAction(previous: JoinView, data: FormData) {
  const { usecases, actor } = await scope()

  return navigate(await joinGroup({ joinGroup: usecases.joinGroup, actor })(previous, data))
}

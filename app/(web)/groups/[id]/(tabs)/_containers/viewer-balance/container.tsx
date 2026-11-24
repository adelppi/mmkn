import { readGroup, readSettlement } from '@/app/_lib/read'
import { toViewerBalanceView } from '@/src/adapter/web/presenter/settlement'
import { ViewerBalancePresentation } from './presentation'

/** あなたの収支（設計 03 の上部）。 */
export async function ViewerBalanceContainer({ groupId }: { readonly groupId: string }) {
  const group = await readGroup(groupId)

  return (
    <ViewerBalancePresentation
      {...toViewerBalanceView(
        group.ok ? group.value.viewer.id : undefined,
        await readSettlement(groupId),
      )}
    />
  )
}

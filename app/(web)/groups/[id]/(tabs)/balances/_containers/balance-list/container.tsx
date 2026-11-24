import { readGroup, readSettlement } from '@/app/_lib/read'
import { toBalanceView } from '@/src/adapter/web/presenter/settlement'
import { BalanceListPresentation } from './presentation'

/** 収支（設計 04）。 */
export async function BalanceListContainer({ groupId }: { readonly groupId: string }) {
  const group = await readGroup(groupId)

  return (
    <BalanceListPresentation
      {...toBalanceView(
        group.ok ? group.value.viewer.id : undefined,
        await readSettlement(groupId),
      )}
    />
  )
}

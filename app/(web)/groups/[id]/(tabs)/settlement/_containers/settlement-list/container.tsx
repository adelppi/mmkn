import { readSettlement } from '@/app/_lib/read'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import type { NoticeView } from '@/src/adapter/web/presenter/notice'
import {
  initialSettlementTransferView,
  toSettlementView,
  type SettlementTransferView,
} from '@/src/adapter/web/presenter/settlement'
import { SettlementListPresentation } from './presentation'

/** 精算（設計 05）。 */
export async function SettlementListContainer({
  groupId,
  action,
  unreachable,
}: {
  readonly groupId: string
  readonly action: FormAction<SettlementTransferView>
  readonly unreachable: NoticeView
}) {
  return (
    <SettlementListPresentation
      {...toSettlementView(await readSettlement(groupId))}
      groupId={groupId}
      action={action}
      initial={initialSettlementTransferView()}
      unreachable={unreachable}
    />
  )
}

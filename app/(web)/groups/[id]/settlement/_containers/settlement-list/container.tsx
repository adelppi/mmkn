import { readSettlement } from '@/app/_lib/read'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import {
  initialSettlementTransferView,
  toSettlementView,
  type SettlementTransferView,
} from '@/src/adapter/web/presenter/settlement'
import { SettlementListPresentation } from './presentation'

/**
 * 精算（設計 05）。
 *
 * **清算案は保存されていない**（`docs/domain/settlement.md`）。表示のたびに、その時点の
 * 記録から導出したものが届く。収支のタブと同じ取得になるため、リクエストの中で束ねられる。
 */
export async function SettlementListContainer({
  groupId,
  action,
}: {
  readonly groupId: string
  readonly action: FormAction<SettlementTransferView>
}) {
  return (
    <SettlementListPresentation
      {...toSettlementView(await readSettlement(groupId))}
      groupId={groupId}
      action={action}
      initial={initialSettlementTransferView()}
    />
  )
}

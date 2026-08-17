'use server'

import { refresh, scope } from '@/app/_lib/action'
import { registerSettlementTransfer } from '@/src/adapter/web/controller/settlement'
import type { SettlementTransferView } from '@/src/adapter/web/presenter/settlement'

/**
 * 清算案の送金を記録する（`docs/domain/settlement.md`「清算案の送金を記録する」）。
 *
 * **その場に留まる。** 記録できたかどうかも、清算案が変わっていたことも、同じ画面で伝わる。
 */
export async function registerSettlementTransferAction(
  previous: SettlementTransferView,
  data: FormData,
) {
  const { usecases, actor } = await scope()

  const view = await registerSettlementTransfer({
    registerSettlementTransfer: usecases.registerSettlementTransfer,
    actor,
  })(previous, data)

  return refresh(view)
}

import { readGroup, readSettlement } from '@/app/_lib/read'
import { toBalanceView } from '@/src/adapter/web/presenter/settlement'
import { BalanceListPresentation } from './presentation'

/**
 * 収支（設計 04）。
 *
 * **記録の全件を読む。** 精算のタブと同じ取得になるため、`app/_lib/read.ts` が
 * リクエストの中で束ねる（`docs/adr/0009-web-ui.md`「Container の粒度」）。
 */
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

import { readGroup, readSettlement } from '@/app/_lib/read'
import { toViewerBalanceView } from '@/src/adapter/web/presenter/settlement'
import { ViewerBalancePresentation } from './presentation'

/**
 * あなたの収支（設計 03 の上部）。
 *
 * **記録の全件を読む。** 同じ取得を精算のタブも行うため、`app/_lib/read.ts` が
 * リクエストの中で束ねている（`docs/adr/0009-web-ui.md`「Container の粒度」）。
 */
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

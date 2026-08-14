import { Suspense } from 'react'

import { RowsSkeleton } from '@/app/_ui/skeleton'
import { unreachableNotice } from '@/src/adapter/web/presenter/notice'
import { registerSettlementTransferAction } from './actions'
import { SettlementListContainer } from './_containers/settlement-list/container'

/** 精算（設計 05）。上端とタブは `../layout.tsx` が持ち、**スクロールするのはここだけ**。 */
export default async function SettlementPage({ params }: PageProps<'/groups/[id]/settlement'>) {
  const { id } = await params

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Suspense fallback={<RowsSkeleton />}>
        <SettlementListContainer
          groupId={id}
          action={registerSettlementTransferAction}
          unreachable={unreachableNotice()}
        />
      </Suspense>
    </div>
  )
}

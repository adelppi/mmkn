import { Suspense } from 'react'

import { RowsSkeleton } from '@/app/_ui/skeleton'
import { BalanceListContainer } from './_containers/balance-list/container'

/** 収支（設計 04）。上端とタブは `../layout.tsx` が持ち、**スクロールするのはここだけ**。 */
export default async function BalancesPage({ params }: PageProps<'/groups/[id]/balances'>) {
  const { id } = await params

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Suspense fallback={<RowsSkeleton />}>
        <BalanceListContainer groupId={id} />
      </Suspense>
    </div>
  )
}

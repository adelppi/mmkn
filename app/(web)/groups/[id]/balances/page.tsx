import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { GroupHeaderContainer } from '../_containers/group-header/container'
import { BalanceListContainer } from './_containers/balance-list/container'

export default async function BalancesPage({ params }: PageProps<'/groups/[id]/balances'>) {
  const { id } = await params

  return (
    <Screen>
      <Suspense fallback={<div className="h-32 animate-pulse bg-muted/40" />}>
        <GroupHeaderContainer groupId={id} current="balances" />
      </Suspense>

      <Suspense fallback={<div className="mt-6 h-48 animate-pulse bg-muted/40" />}>
        <BalanceListContainer groupId={id} />
      </Suspense>
    </Screen>
  )
}

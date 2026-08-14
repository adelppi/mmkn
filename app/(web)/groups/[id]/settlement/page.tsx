import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { GroupHeaderContainer } from '../_containers/group-header/container'
import { registerSettlementTransferAction } from './actions'
import { SettlementListContainer } from './_containers/settlement-list/container'

export default async function SettlementPage({ params }: PageProps<'/groups/[id]/settlement'>) {
  const { id } = await params

  return (
    <Screen>
      <Suspense fallback={<div className="h-32 animate-pulse bg-muted/40" />}>
        <GroupHeaderContainer groupId={id} current="settlement" />
      </Suspense>

      <Suspense fallback={<div className="mt-6 h-48 animate-pulse bg-muted/40" />}>
        <SettlementListContainer groupId={id} action={registerSettlementTransferAction} />
      </Suspense>
    </Screen>
  )
}

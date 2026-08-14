import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { joinGroupAction } from './actions'
import { InviteContainer } from './_containers/invite/container'

export default async function InvitePage({ params }: PageProps<'/j/[code]'>) {
  const { code } = await params

  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <InviteContainer inviteCode={code} action={joinGroupAction} />
    </Suspense>
  )
}

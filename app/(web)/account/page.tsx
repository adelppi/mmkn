import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { logOutAction } from './actions'
import { AccountContainer } from './_containers/account/container'

export default function AccountPage() {
  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <AccountContainer logOutAction={logOutAction} />
    </Suspense>
  )
}

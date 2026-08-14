import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { startAddingLoginMethodAction } from '../login/actions'
import { logOutAction, removeLoginMethodAction } from './actions'
import { LoginMethodsContainer } from './_containers/login-methods/container'

export default function AccountPage() {
  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <LoginMethodsContainer
        removeAction={removeLoginMethodAction}
        addAction={startAddingLoginMethodAction}
        logOutAction={logOutAction}
      />
    </Suspense>
  )
}

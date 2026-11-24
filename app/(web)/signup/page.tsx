import { single } from '@/app/_lib/search-param'
import { INVITE_PARAM } from '@/src/adapter/web/presenter/route'
import { createAccountAction } from './actions'
import { CreateAccountContainer } from './_containers/create-account/container'

export default async function SignUpPage({ searchParams }: PageProps<'/signup'>) {
  return (
    <CreateAccountContainer
      inviteCode={single((await searchParams)[INVITE_PARAM])}
      action={createAccountAction}
    />
  )
}

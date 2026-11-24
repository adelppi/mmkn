import { single } from '@/app/_lib/search-param'
import { INVITE_PARAM, LOGIN_FAILURE_PARAM } from '@/src/adapter/web/presenter/route'
import { startLoginAction } from './actions'
import { LoginContainer } from './_containers/login/container'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams

  return (
    <LoginContainer
      inviteCode={single(params[INVITE_PARAM])}
      failure={single(params[LOGIN_FAILURE_PARAM])}
      action={startLoginAction}
    />
  )
}

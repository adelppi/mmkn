import { startLoginAction } from './actions'
import { LoginContainer } from './_containers/login/container'

export default function LoginPage() {
  return <LoginContainer action={startLoginAction} />
}

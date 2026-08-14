import { startLoginAction } from './actions'
import { LoginChoicesContainer } from './_containers/login-choices/container'

export default function LoginPage() {
  return <LoginChoicesContainer action={startLoginAction} />
}

import { createAccountAction } from './actions'
import { CreateAccountContainer } from './_containers/create-account/container'

export default function SignUpPage() {
  return <CreateAccountContainer action={createAccountAction} />
}

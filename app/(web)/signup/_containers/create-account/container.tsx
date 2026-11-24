import type { FormAction } from '@/src/adapter/web/presenter/form'
import {
  initialCreateAccountView,
  type CreateAccountView,
} from '@/src/adapter/web/presenter/account'
import { CreateAccountPresentation } from './presentation'

/** アカウント作成（設計 13）。 */
export async function CreateAccountContainer({
  inviteCode,
  action,
}: {
  readonly inviteCode: string | undefined
  readonly action: FormAction<CreateAccountView>
}) {
  return <CreateAccountPresentation {...initialCreateAccountView(inviteCode)} action={action} />
}

import { loginServices } from '@/app/_lib/login-services'
import { toLoginView } from '@/src/adapter/web/presenter/account'
import { LoginPresentation } from './presentation'

/**
 * ログイン（設計 01）。
 *
 * **ここはユースケースを呼ばない。** ログインはまだ始まっておらず、示すのは
 * 「どの経路で始められるか」だけである。実際に始めるのは Server Action（`../../actions.ts`）。
 */
export async function LoginChoicesContainer({
  action,
}: {
  readonly action: (service: string) => void
}) {
  return <LoginPresentation {...toLoginView(loginServices())} action={action} />
}

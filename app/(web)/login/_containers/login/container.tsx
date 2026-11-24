import { toLoginView } from '@/src/adapter/web/presenter/account'
import { LoginPresentation } from './presentation'

/**
 * ログイン（設計 01）。
 *
 * **ここはユースケースを呼ばない。** ログインはまだ始まっていない。
 * 実際に始めるのは Server Action（`../../actions.ts`）。
 */
export async function LoginContainer({ action }: { readonly action: () => void }) {
  return <LoginPresentation {...toLoginView()} action={action} />
}

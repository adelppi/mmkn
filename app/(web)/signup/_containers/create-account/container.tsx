import type { FormAction } from '@/src/adapter/web/presenter/form'
import {
  initialCreateAccountView,
  type CreateAccountView,
} from '@/src/adapter/web/presenter/account'
import { CreateAccountPresentation } from './presentation'

/**
 * アカウント作成（設計 13）。
 *
 * **初期状態も Presenter が持つ**（`docs/adr/0009-web-ui.md`「フォーム」）。
 * ここが決めるものは無く、フォームの状態の正は常に「サーバーが返したビューモデル」1 つになる。
 */
export async function CreateAccountContainer({
  action,
}: {
  readonly action: FormAction<CreateAccountView>
}) {
  return <CreateAccountPresentation {...initialCreateAccountView()} action={action} />
}

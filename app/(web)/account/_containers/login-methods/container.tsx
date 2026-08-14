import { loginServices } from '@/app/_lib/login-services'
import { readAccount } from '@/app/_lib/read'
import {
  initialRemoveLoginMethodView,
  toAccountView,
  type RemoveLoginMethodView,
} from '@/src/adapter/web/presenter/account'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import { route } from '@/src/adapter/web/presenter/route'
import { LoginMethodsPresentation } from './presentation'

/**
 * ログイン手段の管理（設計 12）。
 *
 * **使えるサービスの一覧は、追加済みかどうかと合わせて Presenter が組む。**
 * ここが渡すのは「何が使えるか」と「いま何を持っているか」だけである。
 */
export async function LoginMethodsContainer({
  removeAction,
  addAction,
  logOutAction,
}: {
  readonly removeAction: FormAction<RemoveLoginMethodView>
  readonly addAction: (service: string) => void
  readonly logOutAction: () => void
}) {
  return (
    <LoginMethodsPresentation
      {...toAccountView(loginServices(), await readAccount())}
      removeAction={removeAction}
      addAction={addAction}
      logOutAction={logOutAction}
      removeInitial={initialRemoveLoginMethodView()}
      groupsHref={route.groups()}
    />
  )
}

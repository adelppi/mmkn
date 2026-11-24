import { readAccount } from '@/app/_lib/read'
import { toAccountView } from '@/src/adapter/web/presenter/account'
import { AccountPresentation } from './presentation'

/** アカウント（設計 12）。 */
export async function AccountContainer({ logOutAction }: { readonly logOutAction: () => void }) {
  return <AccountPresentation {...toAccountView(await readAccount())} logOutAction={logOutAction} />
}

import Link from 'next/link'

import { Button } from '@/app/_ui/button'
import { AppBar, Empty, Notice, Screen } from '@/app/_ui/notice'
import type { AccountView } from '@/src/adapter/web/presenter/account'

/** アカウント（設計 12）。**ログイン手段の追加と削除は持たない**（`docs/features.md`）。 */
export function AccountPresentation(
  props: AccountView & { readonly logOutAction: () => void },
) {
  if (props.kind === 'notAuthenticated') {
    return (
      <Screen>
        <AppBar>アカウント</AppBar>
        <Empty>
          <Notice>{props.message}</Notice>
          <Button asChild variant="outline" className="font-normal">
            <Link href={props.loginHref}>ログインする</Link>
          </Button>
        </Empty>
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar>
        <Link href={props.groupsHref} className="text-muted-foreground">
          もどる
        </Link>
        <span>{props.name}</span>
      </AppBar>

      <section className="flex flex-col gap-4 p-4">
        <form action={props.logOutAction}>
          <Button type="submit" variant="ghost" className="w-full font-normal text-muted-foreground">
            ログアウト
          </Button>
        </form>
      </section>
    </Screen>
  )
}

import { Button } from '@/app/_ui/button'
import { Screen } from '@/app/_ui/notice'
import type { LoginView } from '@/src/adapter/web/presenter/account'

/**
 * ログイン（設計 01）。
 *
 * **パスワードの入力欄も、再設定の導線も無い**（`docs/adr/0012-login.md`）。
 */
export function LoginPresentation(props: LoginView & { readonly action: () => void }) {
  return (
    <Screen className="justify-center gap-10 px-7 pb-24">
      <p className="tabular text-2xl font-light tracking-[0.24em]">mmkn</p>

      <p className="text-sm leading-loose text-muted-foreground">
        お使いのアカウントでログインします。
      </p>

      <form action={props.action}>
        <Button type="submit" variant="outline" className="h-11 w-full font-normal">
          {props.start}
        </Button>
      </form>

      <p className="text-xs leading-loose text-subtle">
        はじめての方も、そのまま進むと名前を決める画面になります。
      </p>
    </Screen>
  )
}

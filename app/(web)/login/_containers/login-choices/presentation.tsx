import { Button } from '@/app/_ui/button'
import { Screen } from '@/app/_ui/notice'
import type { LoginView } from '@/src/adapter/web/presenter/account'

/**
 * ログイン（設計 01）。
 *
 * **props はビューモデルそのもの**（`docs/adr/0009-web-ui.md`）。データ取得を行わない。
 *
 * **並べるものを画面が決めない。** ログイン手段が増えても、ここは配列を回すだけで変わらない
 * （何が使えるかの正は `docs/adr/0012-login.md`）。
 *
 * **パスワードの入力欄も、再設定の導線も無い**（同上：mmkn はパスワードを持たない）。
 */
export function LoginPresentation(props: LoginView & { readonly action: (service: string) => void }) {
  return (
    <Screen className="justify-center gap-10 px-7 pb-24">
      <p className="tabular text-2xl font-light tracking-[0.24em]">mmkn</p>

      <p className="text-sm leading-loose text-muted-foreground">
        お使いのアカウントでログインします。
      </p>

      <div className="flex flex-col gap-2.5">
        {props.choices.map((choice) => (
          <form key={choice.service} action={props.action.bind(null, choice.service)}>
            <Button type="submit" variant="outline" className="h-11 w-full font-normal">
              {choice.action}
            </Button>
          </form>
        ))}
      </div>

      <p className="text-xs leading-loose text-subtle">
        はじめての方も、そのまま進むと名前を決める画面になります。
      </p>
    </Screen>
  )
}

import { Button } from '@/app/_ui/button'
import { Notice, Screen } from '@/app/_ui/notice'
import type { LoginView } from '@/src/adapter/web/presenter/account'

/** ログイン（設計 01）。 */
export function LoginPresentation(props: LoginView & { readonly action: (data: FormData) => void }) {
  return (
    <Screen className="justify-center gap-10 px-7 pb-24">
      <p className="tabular text-2xl font-light tracking-[0.24em]">mmkn</p>

      <p className="text-sm leading-loose text-muted-foreground">
        お使いのアカウントでログインします。
      </p>

      {props.kind === 'failed' ? <Notice tone="error">{props.message}</Notice> : null}

      <form action={props.action}>
        {props.form.inviteCode === undefined ? null : (
          <input type="hidden" name="inviteCode" value={props.form.inviteCode} readOnly />
        )}

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

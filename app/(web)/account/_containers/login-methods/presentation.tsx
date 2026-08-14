'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/app/_ui/button'
import { AppBar, Empty, Notice, Screen } from '@/app/_ui/notice'
import type {
  AccountView,
  RemoveLoginMethodView,
} from '@/src/adapter/web/presenter/account'
import type { FormAction } from '@/src/adapter/web/presenter/form'

/**
 * ログイン手段の管理（設計 12）。
 *
 * **一覧を表示し、追加と削除ができる**（`docs/features.md` #12）。
 *
 * **最後の 1 つを削除できるかどうかを、ここで判定しない**（`docs/domain/group.md`
 * 「ログイン手段を削除する」）。押させたうえで、失敗はビューモデルのタグとして受け取り、
 * その文言を出す。**判定を画面に写すと、同じルールが 2 か所に存在することになる**
 * （`docs/RULES.md` §7）。
 *
 * **パスワードの入力欄も、再設定の導線も無い**（`docs/adr/0012-login.md`）。
 */
export function LoginMethodsPresentation(
  props: AccountView & {
    readonly removeAction: FormAction<RemoveLoginMethodView>
    readonly addAction: (service: string) => void
    readonly logOutAction: () => void
    readonly removeInitial: RemoveLoginMethodView
    readonly groupsHref: string
  },
) {
  const [removed, remove, pending] = useActionState(props.removeAction, props.removeInitial)

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
        <h1 className="text-sm">ログイン手段</h1>

        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {props.methods.map((method) => (
            <li key={method.service} className="flex items-center justify-between gap-3 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm">{method.label}</span>
                <span className="text-xs text-subtle">{method.status}</span>
              </div>

              {method.connected ? (
                <form action={remove}>
                  <input type="hidden" name="service" value={method.service} readOnly />
                  <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                    削除
                  </Button>
                </form>
              ) : (
                <form action={props.addAction.bind(null, method.service)}>
                  <Button type="submit" variant="outline" size="sm" className="font-normal">
                    追加
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {removed.kind === 'idle' ? null : (
          <Notice tone={removed.kind === 'failed' ? 'error' : 'neutral'}>{removed.message}</Notice>
        )}

        <p
          className={
            props.atRisk
              ? 'rounded-lg border border-destructive-border p-4 text-xs leading-loose text-foreground'
              : 'text-xs leading-loose text-subtle'
          }
        >
          {props.encouragement}
        </p>

        {/* **ログアウトは退会ではない**（`docs/features.md`「mmkn が持たないもの」）。
            記録もログイン手段もそのまま残り、次も同じように入れる。 */}
        <form action={props.logOutAction} className="mt-4">
          <Button type="submit" variant="ghost" className="w-full font-normal text-muted-foreground">
            ログアウト
          </Button>
        </form>
      </section>
    </Screen>
  )
}

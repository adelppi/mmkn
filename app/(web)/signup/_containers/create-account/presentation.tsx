'use client'

import { useActionState } from 'react'

import { Button } from '@/app/_ui/button'
import { Field } from '@/app/_ui/field'
import { Input } from '@/app/_ui/input'
import { Notice, Screen } from '@/app/_ui/notice'
import type { CreateAccountView } from '@/src/adapter/web/presenter/account'
import type { FormProps } from '@/src/adapter/web/presenter/form'

/** アカウント作成（設計 13）。 */
export function CreateAccountPresentation(props: FormProps<CreateAccountView>) {
  const [view, action, pending] = useActionState(props.action, props)

  return (
    <Screen className="justify-center gap-8 px-7 pb-24">
      <p className="tabular text-2xl font-light tracking-[0.24em]">mmkn</p>

      <div className="flex flex-col gap-3">
        <h1 className="text-sm">名前を決めてください</h1>
        <p className="text-sm leading-loose text-muted-foreground">
          グループに参加したときの表示名の初期値になります。あとから変えられます。
        </p>
      </div>

      <form action={action} className="flex flex-col gap-5">
        {view.form.inviteCode === undefined ? null : (
          <input type="hidden" name="inviteCode" value={view.form.inviteCode} readOnly />
        )}

        <Field label="名前" htmlFor="name">
          <Input
            id="name"
            name="name"
            defaultValue={view.form.name}
            required={view.form.nameLimits.required}
            maxLength={view.form.nameLimits.maxLength}
            autoComplete="nickname"
            aria-invalid={view.kind === 'invalid'}
          />
        </Field>

        {view.kind === 'invalid' ? <Notice tone="error">{view.message}</Notice> : null}

        <Button type="submit" disabled={pending} className="h-11 font-normal">
          はじめる
        </Button>
      </form>
    </Screen>
  )
}

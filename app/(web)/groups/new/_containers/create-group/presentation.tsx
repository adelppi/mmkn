'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/app/_ui/button'
import { Field } from '@/app/_ui/field'
import { Input } from '@/app/_ui/input'
import { AppBar, Notice, Screen } from '@/app/_ui/notice'
import { Select } from '@/app/_ui/select'
import type { FormProps } from '@/src/adapter/web/presenter/form'
import type { CreateGroupView } from '@/src/adapter/web/presenter/group'

/**
 * グループ作成（設計 09）。
 *
 * **既定通貨は入力の初期値でしかない**（`docs/domain/group.md`）。ここで選んだ通貨が、
 * そのグループで使える通貨を絞ることはない。
 */
export function CreateGroupPresentation(
  props: FormProps<CreateGroupView> & { readonly groupsHref: string },
) {
  const [view, action, pending] = useActionState(props.action, props)

  return (
    <Screen>
      <AppBar>
        <Link href={props.groupsHref} className="text-muted-foreground">
          もどる
        </Link>
        <span>グループを作成</span>
      </AppBar>

      <form action={action} className="flex flex-1 flex-col gap-5 p-4">
        <Field label="グループ名" htmlFor="name">
          <Input
            id="name"
            name="name"
            defaultValue={view.form.name}
            required={view.form.nameLimits.required}
            maxLength={view.form.nameLimits.maxLength}
            aria-invalid={view.kind === 'invalid'}
          />
        </Field>

        <Field label="既定通貨" htmlFor="defaultCurrency" hint="金額を入力するときの初期値です。">
          <Select id="defaultCurrency" name="defaultCurrency" defaultValue={view.form.defaultCurrency}>
            {view.form.currencies.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        {view.kind === 'invalid' ? <Notice tone="error">{view.message}</Notice> : null}

        <Button type="submit" disabled={pending} className="mt-auto h-11 font-normal">
          作成する
        </Button>
      </form>
    </Screen>
  )
}

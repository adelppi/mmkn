'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/app/_ui/button'
import { Field } from '@/app/_ui/field'
import { Input } from '@/app/_ui/input'
import { AppBar, Empty, Notice, Screen } from '@/app/_ui/notice'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import type { InviteView, JoinView } from '@/src/adapter/web/presenter/group'

/**
 * 招待リンクから参加（設計 10）。
 *
 * **参加する前に見えるのは、グループ名と Member の表示名まで**
 * （`docs/domain/group.md`「グループに参加する」）。記録・収支・清算案の中身は含まない。
 *
 * **表示名の初期値は、その User の名前。** 二重に参加しても新しい Member は作られず、
 * 入力した表示名も反映されない（同上）。そのことは画面で先に伝える。
 */
export function InvitePresentation(
  props: InviteView & {
    readonly action: FormAction<JoinView>
    readonly joinInitial: JoinView
  },
) {
  const [joined, join, pending] = useActionState(props.action, props.joinInitial)

  if (props.kind !== 'ok') {
    return (
      <Screen>
        <AppBar>グループに参加</AppBar>
        <Empty>
          <Notice>{props.message}</Notice>
          <Button asChild variant="outline" className="font-normal">
            <Link href={props.kind === 'notAuthenticated' ? props.loginHref : props.groupsHref}>
              {props.kind === 'notAuthenticated' ? 'ログインする' : 'グループ一覧へ'}
            </Link>
          </Button>
        </Empty>
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar>グループに参加</AppBar>

      <form action={join} className="flex flex-1 flex-col gap-6 p-4">
        <input type="hidden" name="inviteCode" value={props.form.inviteCode} readOnly />

        <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <span className="text-sm">{props.groupName}</span>
          <span className="text-sm text-muted-foreground">{props.memberNames.join(' ・ ')}</span>
        </div>

        {props.alreadyMember ? (
          <Notice>すでにこのグループのメンバーです。表示名はここでは変わりません。</Notice>
        ) : null}

        <Field label="このグループでの表示名" htmlFor="displayName">
          <Input
            id="displayName"
            name="displayName"
            defaultValue={props.form.displayName}
            required={props.form.displayNameLimits.required}
            maxLength={props.form.displayNameLimits.maxLength}
            aria-invalid={joined.kind === 'invalid'}
          />
        </Field>

        {joined.kind === 'invalid' ? <Notice tone="error">{joined.message}</Notice> : null}

        <Button type="submit" disabled={pending} className="mt-auto h-11 font-normal">
          参加する
        </Button>
      </form>
    </Screen>
  )
}

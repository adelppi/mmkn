'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/app/_ui/button'
import { Field, Row } from '@/app/_ui/field'
import { Input } from '@/app/_ui/input'
import { AppBar, Empty, Notice, Screen } from '@/app/_ui/notice'
import { Select } from '@/app/_ui/select'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import type { GroupSettingsView, SaveSettingsView } from '@/src/adapter/web/presenter/group'

/**
 * グループ設定・表示名（設計 11）。
 *
 * **既定通貨を変えても過去の記録は変わらない**（`docs/domain/group.md`）。そのことを画面で伝える。
 *
 * **参加コードは共有リンクとしてしか出さない**（`docs/domain/group.md`「Group の属性」：
 * 人が読んで手で入力する経路を持たない）。
 *
 * **場と Group の対応づけはここに無い。** 場を選べるのは外部サービスの側だけであり、
 * その画面は Discord のアダプタが持つ（`docs/features.md` #13）。
 */
export function GroupSettingsPresentation(
  props: GroupSettingsView & {
    readonly settingsAction: FormAction<SaveSettingsView>
    readonly displayNameAction: FormAction<SaveSettingsView>
    readonly initial: SaveSettingsView
  },
) {
  const [savedSettings, saveSettings, savingSettings] = useActionState(
    props.settingsAction,
    props.initial,
  )
  const [savedName, saveName, savingName] = useActionState(
    props.displayNameAction,
    props.initial,
  )

  if (props.kind !== 'ok') {
    return (
      <Screen>
        <AppBar>グループ設定</AppBar>
        <Empty>
          <Notice>{props.message}</Notice>
          <Button asChild variant="outline" className="font-normal">
            <Link href={props.groupsHref}>グループ一覧へ</Link>
          </Button>
        </Empty>
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar>
        <Link href={props.groupHref} className="flex items-center gap-2">
          <span className="text-muted-foreground">←</span>
          <span>グループ設定</span>
        </Link>
      </AppBar>

      <div className="flex flex-1 flex-col gap-8 p-4 pb-10">
        <form action={saveSettings} className="flex flex-col gap-5">
          <input type="hidden" name="groupId" value={props.groupId} readOnly />

          <Field label="グループ名" htmlFor="name">
            <Input
              id="name"
              name="name"
              defaultValue={props.settings.name}
              required={props.settings.nameLimits.required}
              maxLength={props.settings.nameLimits.maxLength}
            />
          </Field>

          <Field
            label="既定通貨"
            htmlFor="defaultCurrency"
            hint="入力の初期値です。過去の記録の通貨は変わりません。"
          >
            <Select
              id="defaultCurrency"
              name="defaultCurrency"
              defaultValue={props.settings.defaultCurrency}
            >
              {props.settings.currencies.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          {savedSettings.kind === 'idle' ? null : (
            <Notice tone={savedSettings.kind === 'invalid' ? 'error' : 'neutral'}>
              {savedSettings.message}
            </Notice>
          )}

          <Button type="submit" variant="outline" disabled={savingSettings} className="font-normal">
            グループ設定を保存
          </Button>
        </form>

        <form action={saveName} className="flex flex-col gap-5">
          <input type="hidden" name="groupId" value={props.groupId} readOnly />
          <input type="hidden" name="memberId" value={props.viewerMemberId} readOnly />

          <Field
            label="あなたの表示名"
            htmlFor="displayName"
            hint="このグループの中でだけ使われます。過去の記録の表示にも使われます。"
          >
            <Input
              id="displayName"
              name="displayName"
              defaultValue={props.displayName}
              required={props.displayNameLimits.required}
              maxLength={props.displayNameLimits.maxLength}
            />
          </Field>

          {savedName.kind === 'idle' ? null : (
            <Notice tone={savedName.kind === 'invalid' ? 'error' : 'neutral'}>
              {savedName.message}
            </Notice>
          )}

          <Button type="submit" variant="outline" disabled={savingName} className="font-normal">
            表示名を保存
          </Button>
        </form>

        <section className="flex flex-col">
          <Row label="メンバー">
            {props.members.map((member) => member.displayName).join(' ・ ')}
          </Row>
          <Row label="招待リンク">
            <span className="tabular break-all text-xs text-muted-foreground">
              {props.inviteUrl}
            </span>
          </Row>
        </section>
      </div>
    </Screen>
  )
}

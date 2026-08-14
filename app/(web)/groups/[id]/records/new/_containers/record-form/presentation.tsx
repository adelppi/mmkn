'use client'

import Link from 'next/link'
import { XIcon } from 'lucide-react'
import { useActionState, useState } from 'react'

import { Button } from '@/app/_ui/button'
import { Choice, ChoiceGroup } from '@/app/_ui/choice'
import { Field } from '@/app/_ui/field'
import { Input } from '@/app/_ui/input'
import { AppBar, Empty, Notice, Screen } from '@/app/_ui/notice'
import { Select } from '@/app/_ui/select'
import { useUnreachableGuard } from '@/app/_ui/toast'
import { DateInput } from '@/app/_ui/today'
import type { FormProps } from '@/src/adapter/web/presenter/form'
import type { NoticeView } from '@/src/adapter/web/presenter/notice'
import type { RecordFormView } from '@/src/adapter/web/presenter/record'

/**
 * 記録の登録・編集（設計 06・07）。
 *
 * **1 枚のフォームで支払いと送金の両方を扱い、上部の切り替えで選ぶ。**
 *
 * **業務ルールをここに書かない**（`docs/adr/0009-web-ui.md`「クライアント側の入力検査」）。
 * 支払者と負担者の関係も、送り手と受け手が別人であることも、金額の上限も、ここでは見ない。
 * **入力属性に渡す数値はビューモデルから来る**（正はドメイン層）。
 */
export function RecordFormPresentation(
  props: FormProps<RecordFormView> & {
    /** 保存が届かなかったときに伝えること（`src/adapter/web/presenter/notice.ts`）。 */
    readonly unreachable: NoticeView
  },
) {
  const guarded = useUnreachableGuard(props.action, props.unreachable)
  const [view, action, pending] = useActionState(guarded, props)
  const initialType = 'form' in props ? props.form.type : 'payment'
  const [type, setType] = useState<'payment' | 'transfer'>(initialType)

  if (view.kind === 'denied') {
    return (
      <Screen>
        <AppBar>記録する</AppBar>
        <Empty>
          <Notice>{view.message}</Notice>
          <Button asChild variant="outline" className="font-normal">
            <Link href={view.groupsHref}>グループ一覧へ</Link>
          </Button>
        </Empty>
      </Screen>
    )
  }

  const form = view.form
  const editing = form.recordId !== ''

  return (
    <Screen>
      <AppBar>
        <Link href={form.cancelHref} className="text-muted-foreground">
          <XIcon className="size-4.5" />
          <span className="sr-only">やめる</span>
        </Link>
        {editing ? (
          <span>記録を編集</span>
        ) : (
          <span className="flex gap-[3px] rounded-lg bg-muted p-[3px]">
            {(['payment', 'transfer'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                aria-pressed={type === value}
                className={
                  type === value
                    ? 'rounded-md bg-card px-4 py-1.5 text-sm shadow-sm'
                    : 'rounded-md px-4 py-1.5 text-sm text-muted-foreground'
                }
              >
                {value === 'payment' ? '支払い' : '送金'}
              </button>
            ))}
          </span>
        )}
      </AppBar>

      <form action={action} className="flex flex-1 flex-col gap-6 p-4">
        <input type="hidden" name="type" value={type} readOnly />
        <input type="hidden" name="groupId" value={form.groupId} readOnly />
        <input type="hidden" name="recordId" value={form.recordId} readOnly />
        <input type="hidden" name="version" value={form.version} readOnly />

        <div className="flex gap-2.5">
          <Select
            name="currency"
            defaultValue={form.currency}
            aria-label="通貨"
            className="tabular w-32"
          >
            {form.currencies.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            name="amount"
            type="number"
            inputMode="decimal"
            aria-label="金額"
            defaultValue={form.amount}
            required={form.amountLimits.required}
            max={form.amountLimits.max}
            step={form.amountLimits.step}
            min={form.amountLimits.step}
            className="tabular flex-1 text-right text-xl"
            aria-invalid={view.kind === 'invalid'}
          />
        </div>

        {type === 'payment' ? (
          <>
            <Field label="支払った人" htmlFor="payer">
              <ChoiceGroup id="payer">
                {form.members.map((member) => (
                  <Choice
                    key={member.id}
                    type="radio"
                    name="payer"
                    value={member.id}
                    defaultChecked={form.payer === member.id}
                    label={member.displayName}
                  />
                ))}
              </ChoiceGroup>
            </Field>

            <Field label="負担する人" htmlFor="bearers">
              <ChoiceGroup id="bearers">
                {form.members.map((member) => (
                  <Choice
                    key={member.id}
                    type="checkbox"
                    name="bearers"
                    value={member.id}
                    defaultChecked={form.bearers.includes(member.id)}
                    label={member.displayName}
                  />
                ))}
              </ChoiceGroup>
            </Field>

            <Field label="内容（任意）" htmlFor="description">
              <Input
                id="description"
                name="description"
                defaultValue={form.description}
                maxLength={form.descriptionLimits.maxLength}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="送った人" htmlFor="sender">
              <ChoiceGroup id="sender">
                {form.members.map((member) => (
                  <Choice
                    key={member.id}
                    type="radio"
                    name="sender"
                    value={member.id}
                    defaultChecked={form.sender === member.id}
                    label={member.displayName}
                  />
                ))}
              </ChoiceGroup>
            </Field>

            <Field label="受け取った人" htmlFor="recipient">
              <ChoiceGroup id="recipient">
                {form.members.map((member) => (
                  <Choice
                    key={member.id}
                    type="radio"
                    name="recipient"
                    value={member.id}
                    defaultChecked={form.recipient === member.id}
                    label={member.displayName}
                  />
                ))}
              </ChoiceGroup>
            </Field>
          </>
        )}

        {/* 日付の印は端末が持つものを使う（`input[type=date]` の選択ボタン）。 */}
        <Field label="発生日" htmlFor="occurredOn">
          <DateInput id="occurredOn" name="occurredOn" defaultValue={form.occurredOn} required />
        </Field>

        {view.kind === 'invalid' ? <Notice tone="error">{view.message}</Notice> : null}

        {view.kind === 'conflict' ? (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive-border p-4">
            <Notice tone="error">{view.message}</Notice>
            <Button asChild variant="outline" size="sm" className="self-start font-normal">
              <Link href={view.reloadHref}>最新を読み込む</Link>
            </Button>
          </div>
        ) : null}

        <Button type="submit" disabled={pending} className="mt-auto h-11 font-normal">
          {form.submitLabel}
        </Button>
      </form>
    </Screen>
  )
}

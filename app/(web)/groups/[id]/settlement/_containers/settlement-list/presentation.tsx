'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/app/_ui/button'
import { Money } from '@/app/_ui/money'
import { Empty, Notice } from '@/app/_ui/notice'
import { TodayField } from '@/app/_ui/today'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import type {
  SettlementTransferView,
  SettlementView,
} from '@/src/adapter/web/presenter/settlement'

/**
 * 精算（設計 05）。
 *
 * **「送金した」は金額を送らない**（`docs/domain/settlement.md`「清算案の送金を記録する」）。
 * 送るのは誰から誰へ・どの通貨か・発生日だけで、額は登録の時点で導出し直される。
 *
 * **発生日はブラウザ側で組み立てる。** 「今日」がどの日付かは操作した本人の手元で決まる
 * （`docs/domain/record.md`「発生日」）。
 */
export function SettlementListPresentation(
  props: SettlementView & {
    readonly groupId: string
    readonly action: FormAction<SettlementTransferView>
    readonly initial: SettlementTransferView
  },
) {
  const [registered, register, pending] = useActionState(props.action, props.initial)

  // **props はビューモデルそのもの。** 操作の口だけを別に受け取っているため、
  // タグで分けるときはビューモデルの形に置き直す。
  const view: SettlementView = props

  if (view.kind !== 'ok' && view.kind !== 'settled') {
    return (
      <Empty>
        <Notice>{view.message}</Notice>
        <Button asChild variant="outline" className="font-normal">
          <Link href={view.groupsHref}>グループ一覧へ</Link>
        </Button>
      </Empty>
    )
  }

  if (view.kind === 'settled') {
    return (
      <Empty>
        <span className="tabular text-base text-foreground">±0</span>
        {view.message}
      </Empty>
    )
  }

  return (
    <div className="flex flex-1 flex-col pb-8">
      {registered.kind === 'idle' ? null : (
        <div className="mx-4 mt-4 flex flex-col gap-2 rounded-lg border border-border p-4">
          <Notice tone={registered.kind === 'registered' ? 'neutral' : 'error'}>
            {registered.message}
          </Notice>
          {registered.kind === 'changed' ? (
            <Button asChild variant="outline" size="sm" className="self-start font-normal">
              <Link href={registered.reloadHref}>最新の清算案を見る</Link>
            </Button>
          ) : null}
        </div>
      )}

      {view.currencies.map((currency) => (
        <section key={currency.currency}>
          <h2 className="flex items-baseline justify-between px-4 pt-6 pb-2">
            <span className="tabular text-sm tracking-[0.08em]">{currency.currency}</span>
            <span className="text-xs text-subtle">{currency.countLabel}</span>
          </h2>
          <ul>
            {currency.rows.map((row) => (
              <li
                key={`${row.senderMemberId}-${row.recipientMemberId}`}
                className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3"
              >
                <span className="truncate text-sm">
                  {row.senderName} → {row.recipientName}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Money {...row.money} />
                  <form action={register}>
                    <input type="hidden" name="groupId" value={props.groupId} readOnly />
                    <input type="hidden" name="sender" value={row.senderMemberId} readOnly />
                    <input type="hidden" name="recipient" value={row.recipientMemberId} readOnly />
                    <input type="hidden" name="currency" value={row.currency} readOnly />
                    <TodayField name="occurredOn" />
                    <Button type="submit" variant="outline" size="sm" disabled={pending} className="font-normal">
                      {row.actionLabel}
                    </Button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="px-4 pt-6 text-xs leading-loose text-subtle">{view.note}</p>
    </div>
  )
}

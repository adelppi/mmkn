import Link from 'next/link'
import { ArrowLeftRightIcon, PlusIcon, WalletIcon } from 'lucide-react'

import { Button } from '@/app/_ui/button'
import { Money } from '@/app/_ui/money'
import { Empty, Notice } from '@/app/_ui/notice'
import type { RecordListView } from '@/src/adapter/web/presenter/record'

/**
 * 記録一覧（設計 03）。
 *
 * **Payment と Transfer をまとめて 1 つの列として並べる**（`docs/domain/record.md`「記録の並び」）。
 * 並びはビューモデルの通りで、ここで並べ替えない。
 *
 * **あふれるのは一覧だけである**（設計 03）。「支払いを記録する」は一覧の外にあり、
 * 記録が何件あっても画面の下端にとどまる。
 */
export function RecordListPresentation(props: RecordListView) {
  if (props.kind !== 'ok' && props.kind !== 'empty') {
    return (
      <Empty>
        <Notice>{props.message}</Notice>
        <Button asChild variant="outline" className="font-normal">
          <Link href={props.groupsHref}>グループ一覧へ</Link>
        </Button>
      </Empty>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {props.kind === 'empty' ? (
          <Empty>
            <WalletIcon className="size-5.5 text-border" />
            {props.message}
          </Empty>
        ) : (
          props.days.map((day) => (
            <section key={day.occurredOn}>
              <h2 className="px-4 pt-5 pb-2 text-xs text-subtle">{day.label}</h2>
              <ul>
                {day.rows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={row.href}
                      className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {row.type === 'transfer' ? (
                          <ArrowLeftRightIcon className="size-3.5 shrink-0 text-subtle" />
                        ) : null}
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-sm">{row.title}</span>
                          <span className="truncate text-xs text-subtle">{row.detail}</span>
                        </span>
                      </span>
                      <Money {...row.money} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div data-bottom-bar className="shrink-0 border-t border-border p-4 pb-7">
        <Button asChild className="h-11 w-full font-normal">
          <Link href={props.newRecordHref}>
            <PlusIcon />
            支払いを記録する
          </Link>
        </Button>
      </div>
    </div>
  )
}

import Link from 'next/link'

import { Button } from '@/app/_ui/button'
import { Money } from '@/app/_ui/money'
import { Empty, Notice } from '@/app/_ui/notice'
import type { RecordListView } from '@/src/adapter/web/presenter/record'

/**
 * 記録一覧（設計 03）。
 *
 * **Payment と Transfer をまとめて 1 つの列として並べる**（`docs/domain/record.md`「記録の並び」）。
 * 並びはビューモデルの通りで、ここで並べ替えない。
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
    <>
      {props.kind === 'empty' ? (
        <Empty>{props.message}</Empty>
      ) : (
        <div className="flex flex-1 flex-col">
          {props.days.map((day) => (
            <section key={day.occurredOn}>
              <h2 className="px-4 pt-5 pb-2 text-xs text-subtle">{day.label}</h2>
              <ul>
                {day.rows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={row.href}
                      className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-sm">{row.title}</span>
                        <span className="truncate text-xs text-subtle">{row.detail}</span>
                      </span>
                      <Money {...row.money} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-auto p-4 pb-7">
        <Button asChild className="h-11 w-full font-normal">
          <Link href={props.newRecordHref}>支払いを記録する</Link>
        </Button>
      </div>
    </>
  )
}

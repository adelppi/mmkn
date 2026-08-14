import Link from 'next/link'

import { Button } from '@/app/_ui/button'
import { Money } from '@/app/_ui/money'
import { Empty, Notice } from '@/app/_ui/notice'
import type { BalanceView } from '@/src/adapter/web/presenter/settlement'

/**
 * 収支（設計 04）。
 *
 * **通貨ごとに独立して並ぶ**（`docs/domain/money.md`「通貨をまたがない」）。
 * 合算した金額は出さない。**過不足が 0 の Member も落とさない。**
 */
export function BalanceListPresentation(props: BalanceView) {
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

  if (props.kind === 'empty') return <Empty>{props.message}</Empty>

  return (
    <div className="flex flex-1 flex-col pb-8">
      {props.currencies.map((currency) => (
        <section key={currency.currency}>
          <h2 className="flex items-baseline gap-3 px-4 pt-6 pb-2">
            <span className="tabular text-sm tracking-[0.08em]">{currency.currency}</span>
            <span className="text-xs text-subtle">{currency.currencyLabel}</span>
          </h2>
          <ul>
            {currency.rows.map((row) => (
              <li
                key={row.memberId}
                className="flex items-baseline justify-between gap-3 border-b border-border/70 px-4 py-3"
              >
                <span className="truncate text-sm">
                  {row.displayName}
                  {row.isViewer ? <span className="text-subtle">（自分）</span> : null}
                </span>
                <Money {...row.money} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

import { Money } from '@/app/_ui/money'
import { Eyebrow, Notice } from '@/app/_ui/notice'
import type { ViewerBalanceView } from '@/src/adapter/web/presenter/settlement'

/**
 * あなたの収支（設計 03 の上部）。
 *
 * **自分の過不足だけを出す。** 全員分は収支のタブで見る（`docs/domain/settlement.md`）。
 */
export function ViewerBalancePresentation(props: ViewerBalanceView) {
  // 読めなかった理由は上端（`group-header`）が伝える。ここは黙って何も出さない。
  if (props.kind !== 'ok' && props.kind !== 'even') return null

  return (
    <section className="mx-4 mt-4 flex shrink-0 flex-col gap-3 rounded-lg bg-muted p-4">
      <Eyebrow>あなたの収支</Eyebrow>

      {props.kind === 'even' ? (
        <Notice>{props.message}</Notice>
      ) : (
        props.rows.map((row) => (
          <div
            key={`${row.label}${row.money.symbol}`}
            className="flex items-baseline justify-between"
          >
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <Money {...row.money} className="text-base" />
          </div>
        ))
      )}
    </section>
  )
}

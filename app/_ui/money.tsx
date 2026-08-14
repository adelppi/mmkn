import * as React from 'react'

import { cn } from '@/app/_ui/utils'

/**
 * 金額の表示（設計「金額」）。
 *
 * **記号の列と数字の列をそれぞれ右そろえにして、桁が縦にそろうようにする。**
 * 整形そのものは受け取るだけで、ここでは行わない（`app/_ui/**` は層を参照しない）。
 */
export function Money({
  sign,
  symbol,
  digits,
  className,
  ...props
}: React.ComponentProps<'span'> & {
  readonly sign: string
  readonly symbol: string
  readonly digits: string
}) {
  return (
    <span className={cn('tabular inline-flex items-baseline text-sm', className)} {...props}>
      <span className="w-3.5 text-right">{sign}</span>
      <span className="w-9 pr-[0.28em] text-right text-muted-foreground">{symbol}</span>
      <span className="text-right">{digits}</span>
    </span>
  )
}

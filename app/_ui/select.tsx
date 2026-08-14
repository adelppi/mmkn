import * as React from 'react'

import { cn } from '@/app/_ui/utils'

/**
 * 選択欄。**ブラウザ標準の `select` をそのまま使う。**
 *
 * 自前の選択部品にしないのは、通貨の候補が 100 を超える（`docs/domain/money.md`）ためである。
 * 端末が持つ選択の仕組みの方が、その量を扱える。
 */
export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-card px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

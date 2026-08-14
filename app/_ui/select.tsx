import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'

import { cn } from '@/app/_ui/utils'

/**
 * 選択欄。**ブラウザ標準の `select` をそのまま使う。**
 *
 * 自前の選択部品にしないのは、通貨の候補が 100 を超える（`docs/domain/money.md`）ためである。
 * 端末が持つ選択の仕組みの方が、その量を扱える。
 *
 * **開くことは印で示す**（設計 06・09 の下向きの印）。端末ごとに違う既定の印を隠し、
 * 他の画面と同じ形にそろえている。
 */
export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <span className="relative flex items-center">
      <select
        data-slot="select"
        className={cn(
          'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-1 pr-9 pl-3 text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-3 size-3.5 text-subtle" />
    </span>
  )
}

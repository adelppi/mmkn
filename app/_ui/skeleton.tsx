import * as React from 'react'

import { cn } from '@/app/_ui/utils'

/**
 * 読み込み中の置き換え（設計「読み込み中」）。
 *
 * **形だけを先に出す。** 待っている間に白い画面を挟まないためのもので、
 * 何を待っているかは伝えない（伝えることがあるなら、それは知らせ側の仕事）。
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      className={cn('block h-3 animate-pulse rounded bg-muted', className)}
      {...props}
    />
  )
}

/** 一覧が入る場所（設計「読み込み中」の下半分）。行の数は見た目の密度に合わせる。 */
export function RowsSkeleton({ rows = 5, className }: { readonly rows?: number; readonly className?: string }) {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className={cn('flex flex-col gap-5 px-4 py-6', className)}
    >
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="flex items-center justify-between gap-4">
          <Skeleton className="w-32" />
          <Skeleton className="w-18" />
        </span>
      ))}
    </div>
  )
}

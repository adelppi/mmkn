import * as React from 'react'
import Link from 'next/link'

import { cn } from '@/app/_ui/utils'

/**
 * 記録・収支・精算の切り替え（設計「タブ・バッジ」）。
 *
 * **切り替えは画面の移動である。** どこを見ているかがそのまま場所になるため、
 * 状態ではなくリンクで表す。
 */
export function TabBar({
  tabs,
  className,
}: {
  readonly tabs: readonly { readonly href: string; readonly label: string; readonly current: boolean }[]
  readonly className?: string
}) {
  return (
    <nav className={cn('mx-4 mt-4 flex gap-[3px] rounded-lg bg-muted p-[3px]', className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.current ? 'page' : undefined}
          className={cn(
            'flex-1 rounded-md py-2 text-center text-sm transition-colors',
            tab.current ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/app/_ui/utils'

/**
 * 記録・収支・精算の切り替え（設計「タブ・バッジ」）。
 *
 * **どれを選んでいるかは、いまの場所から決める**（`docs/adr/0009-web-ui.md`「上端を共有する」）。
 * **他のタブの中身を先に取りにいく**（同「直前に見たものを取り直さない」）。
 */
export function TabBar({
  tabs,
  className,
}: {
  readonly tabs: readonly { readonly href: string; readonly label: string }[]
  readonly className?: string
}) {
  const pathname = usePathname()

  return (
    <nav className={cn('mx-4 mt-4 flex shrink-0 gap-[3px] rounded-lg bg-muted p-[3px]', className)}>
      {tabs.map((tab) => {
        const current = tab.href === pathname

        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            aria-current={current ? 'page' : undefined}
            className={cn(
              'flex-1 rounded-md py-2 text-center text-sm transition-colors',
              current ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** その場所にいるときだけ出す。上端は切り替えても作り直されないため、出し分けもここで行う。取得はしない。 */
export function OnlyAt({
  href,
  children,
}: {
  readonly href: string
  readonly children: React.ReactNode
}) {
  return usePathname() === href ? <>{children}</> : null
}

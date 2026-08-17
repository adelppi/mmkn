'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/app/_ui/utils'

/**
 * 記録・収支・精算の切り替え（設計「タブ・バッジ」）。
 *
 * **切り替えは画面の移動である。** どこを見ているかがそのまま場所になるため、
 * 状態ではなくリンクで表す。
 *
 * **どれを選んでいるかは、いまの場所から決める。** タブは 3 つの画面で共有される上端にあり
 * （`docs/adr/0009-web-ui.md`「上端を共有する」）、切り替えても作り直されない。作り直されない
 * ものはサーバーの側で「いまどこか」を知り得ないため、ここで見る。**押した直後に選択が変わる**
 * のも同じ理由で、内容が届くのを待たない。
 *
 * **見ている間に、他のタブを先に取りにいく**（同「直前に見たものを取り直さない」）。切り替えは
 * この 3 つの間でしか起こらないため、取りにいく先が確定している。**中身まで取る**のは、
 * 形だけ先に取っても切り替えの待ちが消えないためである（形は `loading.tsx` が既に持っている）。
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

/**
 * その場所にいるときだけ出す。
 *
 * 上端に置かれていて、**タブによって出たり消えたりするもの**のために要る（設計 03 の
 * 「あなたの収支」はタブの上にあり、収支・精算では出ない）。上端は切り替えても作り直されない
 * ため、出し分けもここで行う。**取得はしない。** 中身は既に取れているものを、出すか出さないかだけ。
 */
export function OnlyAt({
  href,
  children,
}: {
  readonly href: string
  readonly children: React.ReactNode
}) {
  return usePathname() === href ? <>{children}</> : null
}

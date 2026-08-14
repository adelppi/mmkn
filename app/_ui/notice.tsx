import * as React from 'react'

import { cn } from '@/app/_ui/utils'

/**
 * 伝えごとの表示（設計「トースト」「入力エラー」）。
 *
 * **何を伝えるかはここで決めない。** 文言はビューモデルとして届く（`docs/adr/0009-web-ui.md`）。
 */
export function Notice({
  tone = 'neutral',
  className,
  ...props
}: React.ComponentProps<'p'> & { readonly tone?: 'neutral' | 'error' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'text-sm leading-relaxed',
        tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** 何も無いことの表示（設計「空状態」）。 */
export function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-3 px-10 py-14 text-center text-sm leading-loose text-subtle',
        className,
      )}
      {...props}
    />
  )
}

/** 画面の上端（設計の各画面）。戻る導線と、右肩の操作を置く。 */
export function AppBar({ className, ...props }: React.ComponentProps<'header'>) {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border px-4 py-4 text-sm',
        className,
      )}
      {...props}
    />
  )
}

/** 画面の本体。スマホ前提の幅に収める（`docs/overview.md`）。 */
export function Screen({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card', className)}
      {...props}
    />
  )
}

/** 見出しの上に置く小さなラベル。 */
export function Eyebrow({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-xs tracking-wide text-subtle', className)} {...props} />
}

import * as React from 'react'

import { cn } from '@/app/_ui/utils'
import { Label } from '@/app/_ui/label'

/**
 * 入力欄ひとつぶん（ラベル・入力・補足）。
 *
 * **入力属性（必須・上限・刻み）は呼ぶ側が渡す。** ここでは決めない
 * （数値の正はドメイン層。`docs/adr/0009-web-ui.md`「クライアント側の入力検査」）。
 */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  readonly label: string
  readonly htmlFor: string
  readonly hint?: string
  readonly className?: string
  readonly children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={htmlFor} className="font-normal">
        {label}
      </Label>
      {children}
      {hint === undefined ? null : <p className="text-xs text-subtle">{hint}</p>}
    </div>
  )
}

/** 値を読むだけの行（設計「グループ設定」「記録の詳細」）。 */
export function Row({
  label,
  className,
  children,
}: {
  readonly label: string
  readonly className?: string
  readonly children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-border/70 py-3 text-sm last:border-b-0',
        className,
      )}
    >
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

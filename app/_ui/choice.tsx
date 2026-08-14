import * as React from 'react'

import { cn } from '@/app/_ui/utils'

/**
 * 選択の部品（設計「選択」）。
 *
 * **ブラウザ標準の入力（checkbox / radio）をそのまま使う。** フォームの送信も、
 * キーボード操作も、ブラウザ側の仕組みに任せる（`docs/adr/0009-web-ui.md`：
 * クライアントで行う検査はブラウザ標準の入力属性までにとどめる）。
 */
export function Choice({
  label,
  className,
  ...props
}: React.ComponentProps<'input'> & { readonly label: string }) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground transition-colors',
        'has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground',
        'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:border-border has-[:disabled]:text-disabled',
        className,
      )}
    >
      <input className="sr-only" {...props} />
      {label}
    </label>
  )
}

/** 選択肢を並べる入れ物。 */
export function ChoiceGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap gap-2', className)} {...props} />
}

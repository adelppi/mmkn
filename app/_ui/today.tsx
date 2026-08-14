'use client'

import * as React from 'react'

import { cn } from '@/app/_ui/utils'

/**
 * 「今日」を入れる入力。
 *
 * **「今日」がどの日付かは、操作した本人の手元で決まる**（`docs/domain/record.md`「発生日」）。
 * サーバーの時計で決めると、地域によっては 1 日ずれた日付が初期値になる。
 * そのためここはブラウザ側で組み立てる。
 *
 * **これは初期値であって、日付そのものの意味を決めるものではない。**
 */
const todayOf = (now: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 空のときだけ、描画後に手元の「今日」を入れる。**入力そのものは操作できるままにする。** */
const useTodayWhenEmpty = () => {
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const input = ref.current
    if (input !== null && input.value === '') input.value = todayOf(new Date())
  }, [])

  return ref
}

/** 発生日の入力欄。空で届いたときだけ、手元の「今日」を初期値にする。 */
export function DateInput({
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'value'>) {
  const ref = useTodayWhenEmpty()

  return (
    <input
      type="date"
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

/** 画面に出さずに「今日」を送る（清算案からの送金記録は、発生日だけを入力に取る）。 */
export function TodayField({ name }: { readonly name: string }) {
  const ref = useTodayWhenEmpty()

  return <input type="hidden" name={name} ref={ref} defaultValue="" />
}

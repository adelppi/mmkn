'use client'

import * as React from 'react'
import { CheckIcon, Trash2Icon, XIcon } from 'lucide-react'

import { cn } from '@/app/_ui/utils'

/**
 * 済んだことの知らせ（設計「トースト（成功・削除・失敗）」）。
 *
 * **何を伝えるかはここで決めない。** 文言と印はビューモデルとして届く
 * （`src/adapter/web/presenter/notice.ts`・`docs/adr/0009-web-ui.md`「トースト」）。
 * ここが持つのは、下端に積むこと・一定時間で消すこと・印ごとの見た目だけである。
 *
 * **操作の口を持たない。** 押せるものを置かないのは、削除に取り消しが無いため
 * （`docs/domain/record.md`「削除」）。やり直しの導線は、それを持つ画面の側に置く。
 */

export type ToastTone = 'done' | 'removed' | 'failed'

export type ToastNotice = {
  readonly tone: ToastTone
  readonly message: string
}

type Toast = ToastNotice & { readonly id: number }

/** 消えるまでの時間。読み終わるだけの長さを取り、操作を待たない。 */
const DISMISS_AFTER_MS = 4_000

const ToastContext = React.createContext<(notice: ToastNotice) => void>(() => {})

/** 知らせを 1 つ出す。**出す先はアプリ全体で 1 か所**（`app/layout.tsx`）。 */
export const useToast = () => React.useContext(ToastContext)

export function ToastProvider({ children }: { readonly children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<readonly Toast[]>([])
  const lastId = React.useRef(0)

  const notify = React.useCallback((notice: ToastNotice) => {
    const id = (lastId.current += 1)

    setToasts((current) => [...current, { ...notice, id }])
    setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      DISMISS_AFTER_MS,
    )
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <ToastList toasts={toasts} />
    </ToastContext.Provider>
  )
}

const ICONS: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  done: CheckIcon,
  removed: Trash2Icon,
  failed: XIcon,
}

/** 下端に積む。**新しいものが下**で、画面の幅は本体（`Screen`）に合わせる。 */
function ToastList({ toasts }: { readonly toasts: readonly Toast[] }) {
  return (
    <div className="mmkn-toast-stack pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col gap-2.5 px-3.5">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone]

        return (
          <div
            key={toast.id}
            role={toast.tone === 'failed' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-card px-4 py-3.5 text-sm leading-relaxed shadow-[0_6px_20px_rgba(27,26,23,0.10)]',
              toast.tone === 'failed' ? 'border-destructive-border' : 'border-border',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                toast.tone === 'failed' ? 'text-destructive' : 'text-foreground',
              )}
            />
            <span className="flex-1">{toast.message}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 届いた知らせを 1 度だけ出す。
 *
 * **同じ知らせを出し直さない。** 画面が取り直されても、伝えごとは 1 回で終わる。
 *
 * `clears` を渡すと、出したあとに問い合わせ文字列からその名前を落とす。**遷移をまたいで運ばれた
 * 印を、運び終えた時点で捨てる**ためで、読み込み直しても同じ知らせが繰り返されない。
 */
export function Announce({
  notice,
  clears,
}: {
  readonly notice: ToastNotice | undefined
  readonly clears?: string
}) {
  const notify = useToast()
  const shown = React.useRef<string | undefined>(undefined)

  React.useEffect(() => {
    if (notice === undefined) return

    const key = `${notice.tone}:${notice.message}`
    if (shown.current === key) return
    shown.current = key

    notify(notice)

    if (clears === undefined) return

    const url = new URL(window.location.href)
    if (!url.searchParams.has(clears)) return

    url.searchParams.delete(clears)
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [notice, clears, notify])

  return null
}

/**
 * 状態が変わったときだけ知らせる。
 *
 * 操作の結果は、同じ文言が続けて返ることがある（同じ送金を 2 回記録したときなど）。
 * **文言ではなく、返ってきた状態そのものが変わったかで見る。**
 */
export function useAnnounceOnChange(state: unknown, notice: ToastNotice | undefined) {
  const notify = useToast()
  const shown = React.useRef(state)

  React.useEffect(() => {
    if (shown.current === state) return
    shown.current = state

    if (notice !== undefined) notify(notice)
  }, [state, notice, notify])
}

/**
 * フレームワークが投げる合図（遷移など）かどうか。
 *
 * **これを失敗として扱わない。** Server Action の中の遷移はこの形で伝わるため、
 * 下の包みが握りつぶすと、保存できているのに失敗したように見える。
 */
const isFrameworkSignal = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  typeof (error as { readonly digest: unknown }).digest === 'string' &&
  (error as { readonly digest: string }).digest.startsWith('NEXT_')

/**
 * 操作がサーバーへ届かなかったときだけ知らせる包み。
 *
 * **届いた失敗はそのまま返す。** 入力の不備も、競合も、前提条件を満たさなかったことも、
 * ビューモデルとして戻ってくる（`docs/adr/0009-web-ui.md`「失敗の描画」）。ここが受け持つのは
 * **返事そのものが無かった場合**だけで、そのとき直前の状態を保ったまま知らせを出す。
 */
export function useUnreachableGuard<S>(
  action: (previous: S, data: FormData) => Promise<S>,
  notice: ToastNotice,
): (previous: S, data: FormData) => Promise<S> {
  const notify = useToast()
  const latest = React.useRef(notice)

  React.useEffect(() => {
    latest.current = notice
  }, [notice])

  return React.useCallback(
    async (previous: S, data: FormData) => {
      try {
        return await action(previous, data)
      } catch (error) {
        if (isFrameworkSignal(error)) throw error

        notify(latest.current)
        return previous
      }
    },
    [action, notify],
  )
}

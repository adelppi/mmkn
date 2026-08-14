import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

import { ToastProvider } from '@/app/_ui/toast'

/**
 * 金額・通貨コード・件数に使う等幅書体（設計「金額」）。
 *
 * **日本語の書体は端末のものを使う**（`app/globals.css` の `--font-sans`）。
 * 本文に使う日本語書体を読み込むと、字数の多さがそのまま転送量になる。
 * 等幅で見せたいのは数字と通貨コードだけで、そこはラテン文字の範囲に収まる。
 */
const mono = IBM_Plex_Mono({
  variable: '--font-mmkn-mono',
  weight: ['300', '400'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'mmkn',
  description: 'グループ内で発生したお金の動きを記録し、清算を導出する',
}

/** スマホでの利用を前提とする（`docs/overview.md`）。 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className={`${mono.variable} h-full`}>
      <body className="min-h-full">
        {/* 済んだことの知らせは画面をまたぐ（設計「トースト」・`docs/adr/0009-web-ui.md`）。 */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}

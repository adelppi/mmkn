import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * クラス名を組み立てる（shadcn/ui の部品が使う）。
 *
 * **ここは UI の部品置き場であり、層ではない**（`docs/adr/0009-web-ui.md`）。
 * `app/_ui/**` から層（`src/**`）と合成ルート（`app/_lib/*`）は参照しない。
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

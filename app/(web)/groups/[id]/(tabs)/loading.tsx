import { RowsSkeleton } from '@/app/_ui/skeleton'

/**
 * タブを切り替えている間に出るもの（設計「読み込み中」）。
 *
 * **待ちを遷移から切り離す。** ここがあることで、押した時点で選択が変わり、
 * 中身の場所は形だけが先に出る。白い画面も、押しても何も起きない間も挟まない。
 *
 * 上端はこの外（`layout.tsx`）にあり、切り替えの影響を受けない。
 */
export default function GroupTabsLoading() {
  return <RowsSkeleton />
}

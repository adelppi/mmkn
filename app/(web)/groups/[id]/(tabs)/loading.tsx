import { RowsSkeleton } from '@/app/_ui/skeleton'

/** タブを切り替えている間に出るもの（設計「読み込み中」）。押した時点で選択が変わり、形だけが先に出る。 */
export default function GroupTabsLoading() {
  return <RowsSkeleton />
}

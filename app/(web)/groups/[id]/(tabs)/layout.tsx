import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { Skeleton } from '@/app/_ui/skeleton'
import { OnlyAt } from '@/app/_ui/tab-bar'
import { route } from '@/src/adapter/web/presenter/route'
import { GroupHeaderContainer } from './_containers/group-header/container'
import { ViewerBalanceContainer } from './_containers/viewer-balance/container'

/**
 * 記録・収支・精算に共通の上端（設計 03〜05）。
 *
 * **3 つのタブで 1 つを共有する**（`docs/adr/0009-web-ui.md`「上端を共有する」）。
 * ここに置いたものはタブを切り替えても作り直されないため、グループ名も設定もタブも
 * 取り直しにならない。切り替えで待つのは `children` だけである。
 *
 * **上端・あなたの収支・タブは動かず、スクロールするのは中身だけ**（設計 03）。
 * 画面の高さを固定し、あふれる場所を `children` の中に閉じ込めている。
 *
 * 記録の登録・詳細・グループ設定はこの上端を持たない（設計 06〜08・11）。
 * そのため 3 つのタブだけを `(tabs)` にまとめ、他の画面はこの層の外に置いている。
 */
export default async function GroupTabsLayout({ children, params }: LayoutProps<'/groups/[id]'>) {
  const { id } = await params

  return (
    <Screen className="h-dvh overflow-hidden">
      <Suspense fallback={<HeaderSkeleton />}>
        <GroupHeaderContainer groupId={id}>
          {/* 「あなたの収支」はタブの上にあり、記録のタブだけに出る（設計 03・04・05）。 */}
          <OnlyAt href={route.group(id)}>
            <Suspense fallback={<ViewerBalanceSkeleton />}>
              <ViewerBalanceContainer groupId={id} />
            </Suspense>
          </OnlyAt>
        </GroupHeaderContainer>
      </Suspense>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </Screen>
  )
}

/** 上端の読み込み中（設計「読み込み中」）。 */
function HeaderSkeleton() {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-5">
        <Skeleton className="w-22" />
        <Skeleton className="size-4" />
      </div>
      <ViewerBalanceSkeleton />
      <div className="mx-4 mt-4 h-9.5 shrink-0 animate-pulse rounded-lg bg-muted" />
    </>
  )
}

function ViewerBalanceSkeleton() {
  return (
    <div className="mx-4 mt-4 flex shrink-0 flex-col gap-3 rounded-lg bg-muted p-4">
      <Skeleton className="w-16 bg-border" />
      <Skeleton className="h-5 w-36 bg-border" />
    </div>
  )
}

import Link from 'next/link'
import { ChevronLeftIcon, SettingsIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppBar, Notice } from '@/app/_ui/notice'
import { TabBar } from '@/app/_ui/tab-bar'
import type { GroupHeaderView } from '@/src/adapter/web/presenter/group'

/**
 * グループの上端（設計 03〜05 に共通）。
 *
 * **3 つのタブで 1 つを共有する**（`docs/adr/0009-web-ui.md`「上端を共有する」）。
 * 切り替えても作り直されないため、どのタブを選んでいるかはここが持たない。
 *
 * **失敗もここで描く。** 3 区別（未ログイン／見つからない／Member でない）は
 * ビューモデルのタグとして届く（`docs/domain/group.md`「前提条件を満たさなかったとき」）。
 *
 * `children` はタブの上に入るもの（設計 03 の「あなたの収支」）。**出し分けは渡す側が決める。**
 */
export function GroupHeaderPresentation(props: GroupHeaderView & { readonly children?: ReactNode }) {
  if (props.kind !== 'ok') {
    return (
      <>
        <AppBar>
          <Link href={props.groupsHref} className="flex items-center gap-2 text-muted-foreground">
            <ChevronLeftIcon className="size-4.5 text-subtle" />
            もどる
          </Link>
        </AppBar>
        <Notice className="p-4">{props.message}</Notice>
      </>
    )
  }

  return (
    <>
      <AppBar>
        <Link href={props.groupsHref} className="flex min-w-0 items-center gap-2">
          <ChevronLeftIcon className="size-4.5 shrink-0 text-subtle" />
          <span className="truncate">{props.name}</span>
        </Link>
        <Link href={props.settingsHref} className="shrink-0 text-muted-foreground">
          <SettingsIcon className="size-4" />
          <span className="sr-only">設定</span>
        </Link>
      </AppBar>

      {props.children}

      <TabBar tabs={props.tabs} />
    </>
  )
}

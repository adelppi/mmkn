import Link from 'next/link'

import { AppBar, Notice } from '@/app/_ui/notice'
import { TabBar } from '@/app/_ui/tab-bar'
import type { GroupHeaderView } from '@/src/adapter/web/presenter/group'

/**
 * グループの上端（設計 03〜05 に共通）。
 *
 * **失敗もここで描く。** 3 区別（未ログイン／見つからない／Member でない）は
 * ビューモデルのタグとして届く（`docs/domain/group.md`「前提条件を満たさなかったとき」）。
 */
export function GroupHeaderPresentation(props: GroupHeaderView) {
  if (props.kind !== 'ok') {
    return (
      <>
        <AppBar>
          <Link href={props.groupsHref} className="text-muted-foreground">
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
        <Link href={props.groupsHref} className="flex items-center gap-2">
          <span className="text-muted-foreground">←</span>
          <span>{props.name}</span>
        </Link>
        <Link href={props.settingsHref} className="text-muted-foreground">
          設定
        </Link>
      </AppBar>
      <TabBar tabs={props.tabs} />
    </>
  )
}

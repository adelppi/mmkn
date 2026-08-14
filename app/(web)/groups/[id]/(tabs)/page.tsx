import { Suspense } from 'react'

import { RowsSkeleton } from '@/app/_ui/skeleton'
import { Announce } from '@/app/_ui/toast'
import { NOTICE_PARAM, toNoticeView } from '@/src/adapter/web/presenter/notice'
import { RecordListContainer } from './_containers/record-list/container'

/**
 * 記録一覧（設計 03）。
 *
 * 上端（グループ名・あなたの収支・タブ）は `layout.tsx` が持つ。**ここが持つのは一覧だけ**で、
 * タブを切り替えても取り直されるのはここだけになる（`docs/adr/0009-web-ui.md`「上端を共有する」）。
 *
 * **済んだことは行き先に付いてくる**（同「トースト」）。記録の登録・編集・削除はこの画面へ戻るため、
 * 何が済んだかは印としてここに届く。
 */
export default async function GroupPage({ params, searchParams }: PageProps<'/groups/[id]'>) {
  const { id } = await params
  const notice = toNoticeView(single((await searchParams)[NOTICE_PARAM]))

  return (
    <>
      <Announce notice={notice} clears={NOTICE_PARAM} />

      <Suspense fallback={<RowsSkeleton />}>
        <RecordListContainer groupId={id} />
      </Suspense>
    </>
  )
}

/** 同じ名前が複数付いていても、知らせは 1 つしか出さない。 */
const single = (value: string | readonly string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.[0]

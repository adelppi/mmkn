import { readRecords } from '@/app/_lib/read'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import type { NoticeView } from '@/src/adapter/web/presenter/notice'
import {
  toEditRecordFormView,
  toNewRecordFormView,
  type RecordFormView,
} from '@/src/adapter/web/presenter/record'
import { RecordFormPresentation } from './presentation'

/**
 * 記録の登録と編集（設計 06・07・08）。
 *
 * **登録と編集で同じ Container を使う。** 出す入力欄も、判定も、保存の経路も同じで、
 * 違うのは初期状態が空か既存の記録かだけである（`docs/domain/record.md`「編集」）。
 * 編集の画面は `records/[recordId]/edit` から、この Container をそのまま呼ぶ。
 *
 * **記録の一覧と同じ取得を使う。** メンバーの選択肢と、入力候補に出す通貨（そのグループに
 * 既に記録がある通貨。`docs/domain/money.md`）を、どちらもここから得る。
 * リクエストの中で束ねられるため、一覧と別に読み直すことにはならない。
 *
 * **成功と失敗で分岐しない**（`docs/adr/0009-web-ui.md`）。読めなかった場合も Presenter がタグにする。
 */
export async function RecordFormContainer({
  groupId,
  recordId,
  action,
  unreachable,
}: {
  readonly groupId: string
  /** 渡すと編集になる。**操作者が見ていた版も、ここから入る。** */
  readonly recordId?: string
  readonly action: FormAction<RecordFormView>
  readonly unreachable: NoticeView
}) {
  const listed = await readRecords(groupId)

  const view =
    recordId === undefined ? toNewRecordFormView(listed) : toEditRecordFormView(recordId, listed)

  return <RecordFormPresentation {...view} action={action} unreachable={unreachable} />
}

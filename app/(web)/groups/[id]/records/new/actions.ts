'use server'

import { navigate, scope } from '@/app/_lib/action'
import { deleteRecord, saveRecord } from '@/src/adapter/web/controller/record'
import type { RecordFormView } from '@/src/adapter/web/presenter/record'

/**
 * 記録を保存する（登録と編集。`docs/features.md` #5〜#7）。
 *
 * **登録か編集かはフォームが持つ記録の識別子で決まる**（`src/adapter/web/controller/record.ts`）。
 */
export async function saveRecordAction(previous: RecordFormView, data: FormData) {
  const { usecases, actor } = await scope()

  return navigate(await saveRecord({ ...usecases, actor })(previous, data))
}

/** 記録を削除する。**復元はできない**（`docs/domain/record.md`「削除」）。 */
export async function deleteRecordAction(previous: RecordFormView, data: FormData) {
  const { usecases, actor } = await scope()

  return navigate(await deleteRecord({ ...usecases, actor })(previous, data))
}

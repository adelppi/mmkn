'use server'

import { refresh, scope } from '@/app/_lib/action'
import { changeDisplayName, changeGroupSettings } from '@/src/adapter/web/controller/group'
import type { SaveSettingsView } from '@/src/adapter/web/presenter/group'

/** グループ設定と表示名の変更（`docs/domain/group.md`）。 */

export async function changeGroupSettingsAction(previous: SaveSettingsView, data: FormData) {
  const { usecases, actor } = await scope()

  const view = await changeGroupSettings({
    changeGroupSettings: usecases.changeGroupSettings,
    actor,
  })(previous, data)

  return refresh(view)
}

export async function changeDisplayNameAction(previous: SaveSettingsView, data: FormData) {
  const { usecases, actor } = await scope()

  const view = await changeDisplayName({
    changeDisplayName: usecases.changeDisplayName,
    actor,
  })(previous, data)

  return refresh(view)
}

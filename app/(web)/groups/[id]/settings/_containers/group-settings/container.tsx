import { readGroup, readRecords } from '@/app/_lib/read'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import {
  initialSaveSettingsView,
  toGroupSettingsView,
  type SaveSettingsView,
} from '@/src/adapter/web/presenter/group'
import { recordedCurrenciesOf } from '@/src/adapter/web/presenter/record'
import { GroupSettingsPresentation } from './presentation'

/**
 * グループ設定（設計 11）。
 *
 * **既に記録がある通貨は、廃止済みでも候補に残す**（`docs/domain/money.md`「廃止された通貨」）。
 * そのために記録も読む。同じ取得は他の Container と束ねられる。
 */
export async function GroupSettingsContainer({
  groupId,
  origin,
  settingsAction,
  displayNameAction,
}: {
  readonly groupId: string
  /** 共有リンクの組み立てに使う。**アダプタ層は実行環境を知らない**ため、入口が渡す。 */
  readonly origin: string
  readonly settingsAction: FormAction<SaveSettingsView>
  readonly displayNameAction: FormAction<SaveSettingsView>
}) {
  const listed = await readRecords(groupId)

  return (
    <GroupSettingsPresentation
      {...toGroupSettingsView(
        origin,
        listed.ok ? recordedCurrenciesOf(listed.value.records) : [],
        await readGroup(groupId),
      )}
      settingsAction={settingsAction}
      displayNameAction={displayNameAction}
      initial={initialSaveSettingsView()}
    />
  )
}

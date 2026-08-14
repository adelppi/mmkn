import { headers } from 'next/headers'
import { Suspense } from 'react'

import { Screen } from '@/app/_ui/notice'
import { changeDisplayNameAction, changeGroupSettingsAction } from './actions'
import { GroupSettingsContainer } from './_containers/group-settings/container'

/** 共有リンクに使う自分の場所。**アダプタ層は実行環境を知らない**ため、ここで解決する。 */
const originOf = async (): Promise<string> => {
  const list = await headers()
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? ''
  const protocol = list.get('x-forwarded-proto') ?? 'http'

  return `${protocol}://${host}`
}

export default async function GroupSettingsPage({ params }: PageProps<'/groups/[id]/settings'>) {
  const { id } = await params

  return (
    <Suspense fallback={<Screen className="animate-pulse" />}>
      <GroupSettingsContainer
        groupId={id}
        origin={await originOf()}
        settingsAction={changeGroupSettingsAction}
        displayNameAction={changeDisplayNameAction}
      />
    </Suspense>
  )
}

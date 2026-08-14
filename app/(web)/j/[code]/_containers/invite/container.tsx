import { readInvite } from '@/app/_lib/read'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import { initialJoinView, toInviteView, type JoinView } from '@/src/adapter/web/presenter/group'
import { InvitePresentation } from './presentation'

/**
 * 招待リンクから参加（設計 10）。
 *
 * **下見もユースケースを通す**（`docs/adr/0005-data-access-and-authorization.md`）。
 * 参加コードから直接リポジトリを引く経路は無い。
 */
export async function InviteContainer({
  inviteCode,
  action,
}: {
  readonly inviteCode: string
  readonly action: FormAction<JoinView>
}) {
  const view = toInviteView(inviteCode, await readInvite(inviteCode))

  return (
    <InvitePresentation
      {...view}
      action={action}
      joinInitial={initialJoinView(
        inviteCode,
        view.kind === 'ok' ? view.form.displayName : '',
      )}
    />
  )
}

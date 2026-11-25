import {
  bundledGroups,
  bundledPayments,
  bundledTransfers,
  bundledUsers,
  unbundled,
  type Reads,
} from '@/app/_lib/bundle'
import { database } from '@/src/infra/db/client'
import { drizzleGroupRepository } from '@/src/infra/db/repository/group'
import { drizzlePaymentRepository } from '@/src/infra/db/repository/payment'
import { drizzleTransferRepository } from '@/src/infra/db/repository/transfer'
import { drizzleUserRepository } from '@/src/infra/db/repository/user'
import type { LogContext } from '@/src/infra/log/logger'
import { logged } from '@/src/infra/log/usecase-log'
import { systemClock } from '@/src/infra/system/clock'
import { cuid2IdGenerator } from '@/src/infra/system/id'
import { cuid2InviteCodeGenerator } from '@/src/infra/system/invite-code'
import { createAccount } from '@/src/usecase/account/create-account'
import { logIn } from '@/src/usecase/account/log-in'
import { logOut } from '@/src/usecase/account/log-out'
import { viewAccount } from '@/src/usecase/account/view-account'
import { changeDisplayName } from '@/src/usecase/group/change-display-name'
import { changeGroupSettings } from '@/src/usecase/group/change-group-settings'
import { createGroup } from '@/src/usecase/group/create-group'
import { joinGroup } from '@/src/usecase/group/join-group'
import { listGroups } from '@/src/usecase/group/list-groups'
import { viewGroup } from '@/src/usecase/group/view-group'
import { viewInvite } from '@/src/usecase/group/view-invite'
import { deletePayment } from '@/src/usecase/record/delete-payment'
import { deleteTransfer } from '@/src/usecase/record/delete-transfer'
import { editPayment } from '@/src/usecase/record/edit-payment'
import { editTransfer } from '@/src/usecase/record/edit-transfer'
import { listRecords } from '@/src/usecase/record/list-records'
import { registerPayment } from '@/src/usecase/record/register-payment'
import { registerTransfer } from '@/src/usecase/record/register-transfer'
import { registerSettlementTransfer } from '@/src/usecase/settlement/register-settlement-transfer'
import { viewSettlement } from '@/src/usecase/settlement/view-settlement'

/**
 * 合成ルート（`docs/adr/0008-layer-internals.md`「合成ルート」）。リクエストごとに呼ぶ。
 *
 * **`reads` を渡すのは読み取りだけの経路（`app/_lib/read.ts`）に限り、既定は束ねない**
 * （`docs/adr/0009-web-ui.md`「束ねる位置」）。
 */
export function wire(context: LogContext, { bundle, viewer }: Reads = unbundled) {
  const db = database()

  const deps = {
    groups: bundledGroups(drizzleGroupRepository(db), bundle),
    users: bundledUsers(drizzleUserRepository(db), bundle, viewer),
    payments: bundledPayments(drizzlePaymentRepository(db), bundle),
    transfers: bundledTransfers(drizzleTransferRepository(db), bundle),
    ids: cuid2IdGenerator,
    clock: systemClock,
    inviteCodes: cuid2InviteCodeGenerator,
  }

  return {
    // アカウント（`docs/features.md` #11）
    createAccount: logged(context, 'createAccount', createAccount(deps)),
    logIn: logged(context, 'logIn', logIn(deps)),
    logOut: logged(context, 'logOut', logOut(deps)),
    viewAccount: logged(context, 'viewAccount', viewAccount(deps)),

    // グループとメンバー（`docs/features.md` #1〜#4）
    createGroup: logged(context, 'createGroup', createGroup(deps)),
    joinGroup: logged(context, 'joinGroup', joinGroup(deps)),
    changeGroupSettings: logged(context, 'changeGroupSettings', changeGroupSettings(deps)),
    changeDisplayName: logged(context, 'changeDisplayName', changeDisplayName(deps)),
    listGroups: logged(context, 'listGroups', listGroups(deps)),
    viewGroup: logged(context, 'viewGroup', viewGroup(deps)),
    viewInvite: logged(context, 'viewInvite', viewInvite(deps)),

    // 記録（`docs/features.md` #5〜#7）
    registerPayment: logged(context, 'registerPayment', registerPayment(deps)),
    editPayment: logged(context, 'editPayment', editPayment(deps)),
    deletePayment: logged(context, 'deletePayment', deletePayment(deps)),
    registerTransfer: logged(context, 'registerTransfer', registerTransfer(deps)),
    editTransfer: logged(context, 'editTransfer', editTransfer(deps)),
    deleteTransfer: logged(context, 'deleteTransfer', deleteTransfer(deps)),
    listRecords: logged(context, 'listRecords', listRecords(deps)),

    // 収支と清算（`docs/features.md` #8〜#10）
    viewSettlement: logged(context, 'viewSettlement', viewSettlement(deps)),
    registerSettlementTransfer: logged(
      context,
      'registerSettlementTransfer',
      registerSettlementTransfer(deps),
    ),
  }
}

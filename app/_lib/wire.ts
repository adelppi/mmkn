import type { AuthClient } from '@/src/infra/auth/client'
import { supabaseExternalAccountRepository } from '@/src/infra/auth/external-account'
import { database, sqlClient } from '@/src/infra/db/client'
import { drizzleGroupRepository } from '@/src/infra/db/repository/group'
import { drizzlePaymentRepository } from '@/src/infra/db/repository/payment'
import { drizzlePlaceMappingRepository } from '@/src/infra/db/repository/place-mapping'
import { drizzleTransferRepository } from '@/src/infra/db/repository/transfer'
import { drizzleUserRepository } from '@/src/infra/db/repository/user'
import type { LogContext } from '@/src/infra/log/logger'
import { logged } from '@/src/infra/log/usecase-log'
import { systemClock } from '@/src/infra/system/clock'
import { cuid2IdGenerator } from '@/src/infra/system/id'
import { cuid2InviteCodeGenerator } from '@/src/infra/system/invite-code'
import { addLoginMethod } from '@/src/usecase/account/add-login-method'
import { createAccount } from '@/src/usecase/account/create-account'
import { logIn } from '@/src/usecase/account/log-in'
import { logOut } from '@/src/usecase/account/log-out'
import { removeLoginMethod } from '@/src/usecase/account/remove-login-method'
import { assignPlace } from '@/src/usecase/group/assign-place'
import { changeDisplayName } from '@/src/usecase/group/change-display-name'
import { changeGroupSettings } from '@/src/usecase/group/change-group-settings'
import { createGroup } from '@/src/usecase/group/create-group'
import { joinGroup } from '@/src/usecase/group/join-group'
import { releasePlace } from '@/src/usecase/group/release-place'
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
 * 合成ルート（`docs/adr/0008-layer-internals.md`「合成ルート」）。
 *
 * **依存の組み立てはここだけで行い、リクエストごとに呼ぶ。DI コンテナのライブラリは使わない。**
 * `container` という名前を使わないのは、`docs/adr/0009-web-ui.md` の Container Component と
 * 衝突するため。
 *
 * **コネクションプールはここで作らない**（`src/infra/db/client.ts` のモジュールスコープにある）。
 * リクエストごとに作り直すのは、ポート実装とユースケースの組み立てだけ。
 *
 * **ログはここで包む**（`docs/adr/0014-logging.md`）。ユースケースの中にログ出力を散らさない。
 *
 * 認証基盤への接続（`auth`）を引数で受けるのは、それが cookie に結びついており、
 * cookie へのアクセス手段がアプリ層から注入されるためである（`docs/adr/0008`「セッションの読み取り」）。
 * **作る場所は `app/_lib/session.ts`。** ここはそれを組み込むだけで、セッションを解決しない。
 */
export function wire(context: LogContext, auth: AuthClient) {
  const db = database()
  const users = drizzleUserRepository(db)

  const deps = {
    groups: drizzleGroupRepository(db),
    users,
    payments: drizzlePaymentRepository(db),
    transfers: drizzleTransferRepository(db),
    placeMappings: drizzlePlaceMappingRepository(db),
    // **ログイン手段だけは mmkn の DB に無い。** 実体は認証基盤の側にある（`adr/0012`）。
    externalAccounts: supabaseExternalAccountRepository({ sql: sqlClient(), client: auth, users }),
    ids: cuid2IdGenerator,
    clock: systemClock,
    inviteCodes: cuid2InviteCodeGenerator,
  }

  return {
    // アカウントとログイン手段（`docs/features.md` #11・#12）
    createAccount: logged(context, 'createAccount', createAccount(deps)),
    logIn: logged(context, 'logIn', logIn(deps)),
    logOut: logged(context, 'logOut', logOut(deps)),
    addLoginMethod: logged(context, 'addLoginMethod', addLoginMethod(deps)),
    removeLoginMethod: logged(context, 'removeLoginMethod', removeLoginMethod(deps)),

    // グループとメンバー（`docs/features.md` #1〜#4・#13）
    createGroup: logged(context, 'createGroup', createGroup(deps)),
    joinGroup: logged(context, 'joinGroup', joinGroup(deps)),
    changeGroupSettings: logged(context, 'changeGroupSettings', changeGroupSettings(deps)),
    changeDisplayName: logged(context, 'changeDisplayName', changeDisplayName(deps)),
    assignPlace: logged(context, 'assignPlace', assignPlace(deps)),
    releasePlace: logged(context, 'releasePlace', releasePlace(deps)),

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

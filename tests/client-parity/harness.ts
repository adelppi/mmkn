import { Member } from '@/src/domain/group/member'
import type { GroupId, MemberId, UserId } from '@/src/domain/id'
import { Payment } from '@/src/domain/record/payment'
import type { DiscordUseCases, Environment } from '@/src/adapter/discord/router'
import { database, sqlClient } from '@/src/infra/db/client'
import { drizzleGroupRepository } from '@/src/infra/db/repository/group'
import { drizzlePaymentRepository } from '@/src/infra/db/repository/payment'
import { drizzlePlaceMappingRepository } from '@/src/infra/db/repository/place-mapping'
import { drizzleTransferRepository } from '@/src/infra/db/repository/transfer'
import { drizzleUserRepository } from '@/src/infra/db/repository/user'
import { connectForTest, truncateAll, type TestDatabase } from '@/src/infra/db/test-support'
import { systemClock } from '@/src/infra/system/clock'
import { cuid2IdGenerator } from '@/src/infra/system/id'
import { cuid2InviteCodeGenerator } from '@/src/infra/system/invite-code'
import { resolveActor } from '@/src/usecase/account/resolve-actor'
import { assignPlace } from '@/src/usecase/group/assign-place'
import { createGroup } from '@/src/usecase/group/create-group'
import { joinGroup } from '@/src/usecase/group/join-group'
import { listGroups } from '@/src/usecase/group/list-groups'
import { releasePlace } from '@/src/usecase/group/release-place'
import { resolvePlace } from '@/src/usecase/group/resolve-place'
import { viewGroup } from '@/src/usecase/group/view-group'
import {
  fakeExternalAccountRepository,
  type FakeExternalAccountRepository,
} from '@/src/usecase/port/fake'
import { deletePayment } from '@/src/usecase/record/delete-payment'
import { deleteTransfer } from '@/src/usecase/record/delete-transfer'
import { editPayment } from '@/src/usecase/record/edit-payment'
import { editTransfer } from '@/src/usecase/record/edit-transfer'
import { registerPayment } from '@/src/usecase/record/register-payment'
import { registerTransfer } from '@/src/usecase/record/register-transfer'
import { registerSettlementTransfer } from '@/src/usecase/settlement/register-settlement-transfer'
import { viewSettlement } from '@/src/usecase/settlement/view-settlement'
import { taro, jiro } from '@/src/usecase/fixture'

/**
 * クライアント間整合のテストの下ごしらえ（`docs/adr/0010-testing.md`
 * 「クライアント間の整合をどう固定するか」）。
 *
 * **入口だけを差し替え、以降は同じユースケースを通ることを結果で確かめる。**
 * そのため、Web と Discord のどちらの run も**同じ組み立て**（実 DB に対するリポジトリ）を使う。
 *
 * **ログイン手段の参照だけは偽実装を使う。** 本物は認証基盤の内部テーブル（`auth.identities`）を
 * 読むもので（`docs/adr/0012-login.md`）、ローカルの Postgres には存在しない。ここで確かめたいのは
 * 「同じ操作が同じ記録になること」であり、ログイン手段の引き方ではない。
 */

export const users = { taro, jiro } as const

/** Discord のユーザー ID。**ログイン手段としての外部アカウント**（`docs/domain/group.md`）。 */
export const discordIds = { taro: '100000000000000001', jiro: '100000000000000002' } as const

export const environment: Environment = {
  origin: 'https://mmkn.example',
  // **発生日の初期値をそろえる。** 実際の日付に左右されると、比べる相手が日ごとに変わる。
  today: '2026-08-14',
}

/**
 * Web と Discord の両方の入口が要るユースケース。
 *
 * **どちらの run も、まったく同じこの組み立てを使う**（`docs/adr/0010-testing.md`：
 * 入口だけを差し替える）。記録の編集・削除は今回のシナリオに出てこないが、
 * Web の入口（1 つのフォームが登録と編集を兼ねる）が受け取る形に含まれるため揃えてある。
 */
export type Harness = {
  readonly db: TestDatabase
  readonly usecases: DiscordUseCases & {
    readonly joinGroup: ReturnType<typeof joinGroup>
    readonly editPayment: ReturnType<typeof editPayment>
    readonly deletePayment: ReturnType<typeof deletePayment>
    readonly editTransfer: ReturnType<typeof editTransfer>
    readonly deleteTransfer: ReturnType<typeof deleteTransfer>
  }
  readonly externalAccounts: FakeExternalAccountRepository
}

export const connect = async (): Promise<TestDatabase> => await connectForTest()

/**
 * 空の DB に前提の User だけを置き、ユースケースを組み立てる。
 *
 * **run のたびに DB を空にする。** 2 つの run が同じ入力から始まることを保証するためで、
 * 片方の記録がもう片方に混ざると「一致した」の意味が消える。
 */
export const freshHarness = async (db: TestDatabase): Promise<Harness> => {
  await truncateAll(db.db)

  const connection = database()
  const userRepository = drizzleUserRepository(connection)
  await userRepository.create(taro)
  await userRepository.create(jiro)

  const externalAccounts = fakeExternalAccountRepository([
    { userId: taro.id, account: { service: 'discord', id: discordIds.taro } },
    { userId: jiro.id, account: { service: 'discord', id: discordIds.jiro } },
  ])

  const deps = {
    groups: drizzleGroupRepository(connection),
    users: userRepository,
    payments: drizzlePaymentRepository(connection),
    transfers: drizzleTransferRepository(connection),
    placeMappings: drizzlePlaceMappingRepository(connection),
    externalAccounts,
    ids: cuid2IdGenerator,
    clock: systemClock,
    inviteCodes: cuid2InviteCodeGenerator,
  }

  return {
    db,
    externalAccounts,
    usecases: {
      createGroup: createGroup(deps),
      joinGroup: joinGroup(deps),
      listGroups: listGroups(deps),
      viewGroup: viewGroup(deps),
      viewSettlement: viewSettlement(deps),
      registerPayment: registerPayment(deps),
      editPayment: editPayment(deps),
      deletePayment: deletePayment(deps),
      registerTransfer: registerTransfer(deps),
      editTransfer: editTransfer(deps),
      deleteTransfer: deleteTransfer(deps),
      registerSettlementTransfer: registerSettlementTransfer(deps),
      assignPlace: assignPlace(deps),
      releasePlace: releasePlace(deps),
      resolveActor: resolveActor(deps),
      resolvePlace: resolvePlace(deps),
    },
  }
}

/** 接続を閉じる。**ドライバの接続はモジュールスコープにあるため、最後に 1 回だけ。** */
export const disconnect = async (db: TestDatabase): Promise<void> => {
  await db.close()
  await sqlClient().end()
}

// ── 比べる形（`docs/adr/0010`：**結果で見る**）─────────────────────────────────

/**
 * できあがった記録を、入口によらない形に写す。
 *
 * **識別子と登録日時は含めない。** どちらも run ごとに必ず違い、比べても
 * 「入口が違えば結果も違う」以上のことを言わない。**比べるのは意味のほうである。**
 */
export type Projection = {
  readonly group: { readonly name: string; readonly defaultCurrency: string }
  readonly members: readonly string[]
  readonly payments: readonly {
    readonly payer: string
    readonly amount: number
    readonly currency: string
    readonly occurredOn: string
    readonly description: string
    readonly shares: readonly (readonly [string, number])[]
  }[]
  readonly transfers: readonly {
    readonly sender: string
    readonly recipient: string
    readonly amount: number
    readonly currency: string
    readonly occurredOn: string
  }[]
  readonly balances: readonly {
    readonly currency: string
    readonly rows: readonly (readonly [string, number])[]
  }[]
  readonly settlements: readonly {
    readonly currency: string
    readonly transfers: readonly (readonly [string, string, number])[]
  }[]
}

export const projectionOf = async (
  harness: Harness,
  input: { readonly actor: UserId; readonly group: GroupId },
): Promise<Projection> => {
  const connection = database()

  const viewed = await harness.usecases.viewGroup(input)
  if (!viewed.ok) throw new Error('前提の Group を読めなかった')
  const group = viewed.value.group

  const name = (member: MemberId): string =>
    Member.byId(group.members, member)?.displayName ?? '（不明）'

  const [payments, transfers, settlement] = await Promise.all([
    drizzlePaymentRepository(connection).listByGroup(group.id),
    drizzleTransferRepository(connection).listByGroup(group.id),
    harness.usecases.viewSettlement(input),
  ])
  if (!settlement.ok) throw new Error('前提の収支を読めなかった')

  return {
    group: { name: group.name, defaultCurrency: group.defaultCurrency },
    members: group.members.map((member) => member.displayName).sort(),
    payments: payments.map(({ record }) => ({
      payer: name(record.payer),
      amount: record.money.amount,
      currency: record.money.currency,
      occurredOn: record.occurredOn,
      description: record.description,
      shares: Payment.shares(record).map((share) => [name(share.bearer), share.amount] as const),
    })),
    transfers: transfers.map(({ record }) => ({
      sender: name(record.sender),
      recipient: name(record.recipient),
      amount: record.money.amount,
      currency: record.money.currency,
      occurredOn: record.occurredOn,
    })),
    balances: settlement.value.balances.map(({ currency, balances }) => ({
      currency,
      rows: balances.map((balance) => [name(balance.member), balance.amount] as const),
    })),
    settlements: settlement.value.settlements.map((it) => ({
      currency: it.currency,
      transfers: it.transfers.map(
        (transfer) => [name(transfer.sender), name(transfer.recipient), transfer.amount] as const,
      ),
    })),
  }
}

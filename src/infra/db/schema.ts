import { sql } from 'drizzle-orm'
import {
  bigint,
  date,
  index,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * テーブル定義（`docs/adr/0005-data-access-and-authorization.md`）。
 *
 * **この定義から SQL を生成し、その SQL をコミットする**（`migrations/`）。本番にスキーマを
 * 直接反映する経路（push 型）は使わない。生成と適用の手順は `docs/operations.md`。
 *
 * テーブル設計そのものは `docs/domain/` から起こす実装作業であり、ここに業務ルールを書かない
 * （`docs/RULES.md` §2）。DB 側に置くのは**一意性と参照の整合**だけで、**判断（誰が何をしてよいか・
 * 値が妥当か）はドメイン層にしか置かない**（`docs/adr/0005`「ドメインにしか置かないものと、
 * DB にも置くものの線引き」）。
 *
 * **連携する外部アカウントのテーブルはここに無い。** 参照先は認証基盤の側であり、
 * `ExternalAccountRepository` の実装は `infra/auth` が持つ（`docs/adr/0007`）。
 */

/**
 * 全拒否ポリシー（`docs/adr/0005`「認可の置き場所」）。
 *
 * **RLS を認可の正本にはしないが、有効化しないテーブルは anon key 経由で誰でも読み書きできてしまう。**
 * アプリは `DATABASE_URL` で直接接続し PostgREST を経由しないため、このポリシーは動作に影響しない。
 *
 * **テーブルを追加したら、必ずこれも付ける**（付け忘れは `schema.db.test.ts` が落とす）。
 */
const denyAll = (table: string) =>
  pgPolicy(`${table}_deny_all`, {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`false`,
    withCheck: sql`false`,
  })

/** mmkn を利用する人そのもの（`docs/domain/group.md`「User の属性」）。 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** **mmkn 全体で重複しない。** 同時実行でしか壊れないため、DB の制約でも担保する。 */
    loginIdentifier: text('login_identifier').notNull(),
  },
  (t) => [unique('users_login_identifier_unique').on(t.loginIdentifier), denyAll('users')],
).enableRLS()

/** お金の動きを管理する単位（`docs/domain/group.md`「Group の属性」）。 */
export const groups = pgTable(
  'groups',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** 入力の初期値。**扱える通貨を制限しない**（`docs/domain/money.md`）。 */
    defaultCurrency: text('default_currency').notNull(),
    /** **グループ間で衝突しない**（`docs/adr/0002-invite-code.md`）。 */
    inviteCode: text('invite_code').notNull(),
  },
  (t) => [unique('groups_invite_code_unique').on(t.inviteCode), denyAll('groups')],
).enableRLS()

/** ある User の、ある Group における立場（`docs/domain/group.md`「Member の属性」）。 */
export const members = pgTable(
  'members',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    displayName: text('display_name').notNull(),
  },
  (t) => [
    /**
     * **同じ Group・同じ User の組が 2 つ存在しない**（`docs/adr/0005`）。
     *
     * 制約で弾く形にすることで、リポジトリが現在の Member 一覧を読んでから書き戻す必要がなくなる。
     */
    unique('members_group_id_user_id_unique').on(t.groupId, t.userId),
    index('members_group_id_idx').on(t.groupId),
    denyAll('members'),
  ],
).enableRLS()

/** 支払い（`docs/domain/record.md`「Payment（支払い）」）。 */
export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    /** 支払いを行った Member。**登録者（`recorded_by`）とは別のもの。** */
    payerMemberId: text('payer_member_id')
      .notNull()
      .references(() => members.id),
    /** その通貨の最小単位を 1 とした値（`docs/domain/money.md`「金額の表し方」）。 */
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    /** **時刻もタイムゾーンも持たない日付**（`docs/domain/record.md`「発生日」）。 */
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    description: text('description').notNull(),
    /** 登録した User。**何にも使わない**（`docs/domain/record.md`「登録者」）。 */
    recordedBy: text('recorded_by')
      .notNull()
      .references(() => users.id),
    /** 登録された時点。**編集で変わらない。** */
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
    /** 楽観ロックの版（`docs/adr/0005`「同時書き込みの競合」）。 */
    version: integer('version').notNull().default(1),
  },
  (t) => [index('payments_group_id_idx').on(t.groupId), denyAll('payments')],
).enableRLS()

/**
 * Payment の負担者（`docs/domain/record.md`「支払者と負担者」）。
 *
 * Payment 集約の内側にあるため、Payment を消せば一緒に消える。
 * **負担額は保存しない。** 金額と負担者から導出する（`docs/domain/record.md`「負担額の配分」）。
 */
export const paymentBearers = pgTable(
  'payment_bearers',
  {
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
  },
  (t) => [
    primaryKey({ name: 'payment_bearers_pkey', columns: [t.paymentId, t.memberId] }),
    denyAll('payment_bearers'),
  ],
).enableRLS()

/** 送金（`docs/domain/record.md`「Transfer（送金）」）。 */
export const transfers = pgTable(
  'transfers',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
    senderMemberId: text('sender_member_id')
      .notNull()
      .references(() => members.id),
    recipientMemberId: text('recipient_member_id')
      .notNull()
      .references(() => members.id),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    recordedBy: text('recorded_by')
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
    version: integer('version').notNull().default(1),
  },
  (t) => [index('transfers_group_id_idx').on(t.groupId), denyAll('transfers')],
).enableRLS()

/**
 * 場と Group の対応（`docs/domain/group.md`「Group と外部サービスの場」）。
 *
 * **1 つの場に対応する Group は 1 つ**であるため、場が鍵になる。
 * 1 つの Group が複数の場に対応することは、鍵の違う行が複数あることとして表れる。
 */
export const placeMappings = pgTable(
  'place_mappings',
  {
    service: text('service').notNull(),
    placeId: text('place_id').notNull(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id),
  },
  (t) => [
    primaryKey({ name: 'place_mappings_pkey', columns: [t.service, t.placeId] }),
    denyAll('place_mappings'),
  ],
).enableRLS()

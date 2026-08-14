import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * DB への接続（`docs/adr/0005-data-access-and-authorization.md`「データアクセス経路」）。
 *
 * **アプリのデータアクセスは `DATABASE_URL` + 通常の Postgres ドライバ + ORM で行う。**
 * 認証基盤の SDK（PostgREST 経由のクライアント直接アクセス）はデータアクセスに使わない。
 *
 * **ORM はこの層の中に閉じ込め、その外から呼ばない**（`docs/adr/0004`）。
 */

/** ORM のインスタンスの型。**この型が `infra/db` の外へ出ることはない**（`docs/adr/0008`）。 */
export type Database = PostgresJsDatabase<typeof schema>

/**
 * ドライバの接続。**ORM を通さない問い合わせだけがこれを使う。**
 *
 * 使う先は `infra/auth` の 1 か所しかない。認証基盤の内部テーブル（`auth` スキーマ）は
 * mmkn のスキーマ定義（`schema.ts`）に無く、ORM から引けないためである
 * （`docs/adr/0007-external-account-linking.md`「認証基盤のスキーマへの依存をポートで隔離する」）。
 * **ORM は引き続き `infra/db` の中だけに閉じる。**
 */
export type SqlClient = ReturnType<typeof createClient>

/**
 * 接続を作る。
 *
 * **Supavisor の transaction mode では prepared statement が使えないため、ドライバ側で無効化する**
 * （`docs/adr/0005`「接続の要件」）。接続文字列に付ける `?pgbouncer=true` は別の ORM 固有の
 * フラグであり、ここでは読まれない（`.env.example`）。
 */
export const createClient = (url: string) =>
  postgres(url, {
    prepare: false,
    // ドライバの通知（NOTICE）は既定で標準出力へ素のまま出る。**ログは 1 行 1 JSON に揃える**
    // （`docs/adr/0014-logging.md`）ため、その経路を塞ぐ。障害の切り分けは診断で行う。
    onnotice: () => {},
  })

export const createDatabase = (client: ReturnType<typeof createClient>): Database =>
  drizzle(client, { schema })

const url = (): string => {
  const value = process.env.DATABASE_URL
  if (value === undefined || value === '') {
    throw new Error('DATABASE_URL が設定されていない')
  }
  return value
}

/**
 * コネクションプールを持つ接続。**モジュールスコープに置く**（`docs/adr/0003-tech-stack.md`）。
 *
 * サーバーレスでは「リクエストをまたいで意味を持つ状態」を持たないのが原則だが、
 * コネクションプールは業務上の意味を持たず、失われても次のリクエストで作り直されるだけであるため
 * 対象外とされている。合成ルート（`app/_lib/wire.ts`）はリクエストごとに呼ばれるが、
 * ここはその外側で一度だけ作られる。
 */
let sharedClient: SqlClient | undefined
let shared: Database | undefined

/** ドライバの接続。**ORM と同じプールを使う**（接続数を二重に持たないため）。 */
export const sqlClient = (): SqlClient => (sharedClient ??= createClient(url()))

export const database = (): Database => (shared ??= createDatabase(sqlClient()))

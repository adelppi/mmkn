import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/** DB への接続（`docs/adr/0005-data-access-and-authorization.md`「データアクセス経路」）。 */

/** ORM のインスタンスの型。**この型が `infra/db` の外へ出ることはない**（`docs/adr/0008`）。 */
export type Database = PostgresJsDatabase<typeof schema>

/**
 * 接続を作る。
 *
 * **Supavisor の transaction mode では prepared statement が使えないため、ドライバ側で無効化する**
 * （`docs/adr/0005`「接続の要件」）。
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

/** コネクションプールを持つ接続。**モジュールスコープに置く**（`docs/adr/0003-tech-stack.md`）。 */
let shared: Database | undefined

export const database = (): Database => (shared ??= createDatabase(createClient(url())))

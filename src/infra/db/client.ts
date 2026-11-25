import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { connectionString } from './connection-string'
import * as schema from './schema'

/** DB への接続（`docs/adr/0005-data-access-and-authorization.md`「データアクセス経路」）。 */

/** ORM のインスタンスの型。**この型が `infra/db` の外へ出ることはない**（`docs/adr/0008`）。 */
export type Database = NodePgDatabase<typeof schema>

/** 接続を張り直すまでの時間。 */
const MAX_LIFETIME_SECONDS = 30 * 60

/** 繋がらないまま待ち続けない。 */
const CONNECTION_TIMEOUT_MS = 30_000

/**
 * 接続を作る。
 *
 * **Supavisor の transaction mode では prepared statement が使えない**（`docs/adr/0005`「接続の要件」）。
 * このドライバは、問い合わせに名前を付けたときだけ prepared statement を作る。**名前を付けない。**
 */
export const createClient = (url: string): Pool => {
  const pool = new Pool({
    connectionString: connectionString(url),
    // **暇な接続を閉じない。** 張り直しには問い合わせ数本ぶんの往復がかかる。
    idleTimeoutMillis: 0,
    maxLifetimeSeconds: MAX_LIFETIME_SECONDS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    keepAlive: true,
  })

  // **使っていない接続が切れたときに届く。** 受け手が無いとプロセスごと落ちる。
  // 切れた接続はプールが捨て、次の問い合わせが張り直す。問い合わせの失敗はここには来ない。
  pool.on('error', () => {})

  return pool
}

export const createDatabase = (client: Pool): Database => drizzle(client, { schema })

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

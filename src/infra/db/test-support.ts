import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createClient, createDatabase, type Database } from './client'

/**
 * 永続化テストが使う下ごしらえ。**テストからだけ使う。**
 *
 * **コミット済みのマイグレーションをそのまま当てる**（`docs/adr/0010-testing.md`）。
 * スキーマ定義から直接テーブルを作ると、生成した SQL の側が壊れていても気づけない。
 */

export const MIGRATIONS_FOLDER = 'src/infra/db/migrations'

export type TestDatabase = {
  readonly db: Database
  readonly close: () => Promise<void>
}

/** 手元と CI の使い捨て Postgres は、どちらもループバックにいる。 */
const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]']

/**
 * 接続先がローカルの Postgres であることを確かめる。
 *
 * **永続化テストは中身を空にしてから回る。** 接続先を間違えると、そこにあるデータを消す。
 * `docs/adr/0011-ci-and-release.md` は「未マージのコードが本番データに到達する経路を作らない」
 * と定めており、**その経路をここで塞ぐ**（`.env.example`「手元の値に本番を書かない」も同じ要求）。
 *
 * 手元の Postgres は `127.0.0.1`（`docker-compose.yml`）、CI の使い捨て Postgres も
 * 同じホストから見えるため、ループバック以外を弾いても回らなくなるものは無い。
 */
const requireLocal = (url: string): string => {
  const host = URL.parse(url)?.hostname
  if (host === undefined || !LOOPBACK_HOSTS.includes(host)) {
    throw new Error(
      `永続化テストはローカルの Postgres にだけ繋ぐ（DATABASE_URL の接続先が ${host ?? '読めない値'} になっている）`,
    )
  }
  return url
}

/**
 * ローカル Postgres に繋ぎ、マイグレーションを当てる。
 *
 * 接続先は `DATABASE_URL`。手元では `docker compose up -d --wait` で起動したものを指す
 * （`docs/operations.md`「手元の準備」）。
 */
export const connectForTest = async (): Promise<TestDatabase> => {
  const url = process.env.DATABASE_URL
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL が設定されていない（docker compose up -d --wait を先に実行する）')
  }

  const client = createClient(requireLocal(url))
  const db = createDatabase(client)

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  return { db, close: () => client.end() }
}

/**
 * すべてのテーブルを空にする。
 *
 * **表を列挙しない。** 列挙すると、テーブルを足したときに消し忘れたテーブルだけが
 * 前のテストの中身を持ち越す。
 */
export const truncateAll = async (db: Database): Promise<void> => {
  await db.execute(sql`
    DO $$
    DECLARE statement text;
    BEGIN
      SELECT 'TRUNCATE TABLE '
             || string_agg(format('%I.%I', schemaname, tablename), ', ')
             || ' CASCADE'
        INTO statement
        FROM pg_tables
       WHERE schemaname = 'public';

      IF statement IS NOT NULL THEN
        EXECUTE statement;
      END IF;
    END $$;
  `)
}

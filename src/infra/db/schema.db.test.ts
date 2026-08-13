import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectForTest, type TestDatabase } from './test-support'

/**
 * スキーマそのものへの検査（`docs/adr/0010-testing.md`「実 DB を使うテスト」）。
 *
 * `docs/adr/0005-data-access-and-authorization.md` は「**テーブルを追加したら全拒否ポリシーも
 * 必ず追加する。付け忘れたテーブルだけが anon key に露出する**」を留意点に挙げている。
 * **付け忘れを人の注意力に任せず、スキーマを走査して検証する。**
 */

let database: TestDatabase

beforeAll(async () => {
  database = await connectForTest()
})

afterAll(async () => {
  await database.close()
})

describe('RLS の網羅', () => {
  it('public のテーブルが 1 つ以上ある（走査そのものが空振りしていない）', async () => {
    const rows = await database.db.execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    )

    expect(rows.length).toBeGreaterThan(0)
  })

  it('すべてのテーブルで RLS が有効になっている', async () => {
    const rows = await database.db.execute<{ tablename: string }>(sql`
      SELECT c.relname AS tablename
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND c.relrowsecurity = false
    `)

    expect(rows.map((row) => row.tablename)).toEqual([])
  })

  it('すべてのテーブルに「誰も通さない」ポリシーが置かれている', async () => {
    const rows = await database.db.execute<{ tablename: string }>(sql`
      SELECT c.relname AS tablename
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND NOT EXISTS (
               SELECT 1
                 FROM pg_policy p
                WHERE p.polrelid = c.oid
             )
    `)

    expect(rows.map((row) => row.tablename)).toEqual([])
  })

  it('ポリシーは業務ルールを持たず、常に false で拒否する', async () => {
    // 業務ルールを DB のポリシーに書かない（`docs/adr/0005`「認可の置き場所」）。
    // 条件が `false` 以外になっていたら、ルールが 2 か所に分裂している。
    const rows = await database.db.execute<{ policyname: string; qual: string | null }>(sql`
      SELECT policyname, qual
        FROM pg_policies
       WHERE schemaname = 'public'
         AND qual IS DISTINCT FROM 'false'
    `)

    expect(rows.map((row) => row.policyname)).toEqual([])
  })
})

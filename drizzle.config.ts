import { defineConfig } from 'drizzle-kit'

/**
 * ORM の設定。
 *
 * **設定ファイルだけはリポジトリ直下に置き、出力先をインフラ層の永続化のディレクトリへ向ける**
 * （`docs/adr/0005-data-access-and-authorization.md`「マイグレーション」）。
 * スキーマ定義と生成した SQL は、どちらも `src/infra/db/` に置く。
 *
 * **本番にスキーマを直接反映する経路（push 型）は使わない。** 生成した SQL をコミットし、
 * リリースの一部として適用する。手順は `docs/operations.md`。
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/db/schema.ts',
  out: './src/infra/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  // ロールは mmkn では作らない。RLS の全拒否ポリシーが指すのは組み込みの `public` だけ。
  entities: { roles: false },
  strict: true,
})

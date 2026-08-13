import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * 永続化テストの設定（`docs/adr/0010-testing.md`「実 DB を使うテスト」）。
 *
 * **ローカルの Postgres にマイグレーションを当て、`infra/db` のリポジトリをそこに対してテストする。**
 * Supabase のローカル環境は使わない。起動は `docker compose up -d --wait`（`docs/operations.md`）。
 *
 * 単体テスト（`vitest.config.ts`）とは別の設定にしてある。**単体テストは何も起動せずに回る状態を
 * 保つ**ためで、`*.db.test.ts` はあちらの対象から外してある。
 */
/**
 * `.env.local` などのファイルを読む。Next.js と違い、テストランナーは自分で読み込まない。
 *
 * **実際の環境変数がファイルより優先される。** 一度きり別の接続先を指したいときに、
 * `DATABASE_URL=… npm run test:db` で上書きできる状態を保つ。
 */
const fileEnv = (mode: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(loadEnv(mode, process.cwd(), '')).map(([key, value]) => [
      key,
      process.env[key] ?? value,
    ]),
  )

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    env: fileEnv(mode),
    // 同じ DB を共有し、各テストの前に中身を空にするため、並走させない。
    fileParallelism: false,
    testTimeout: 20_000,
  },
}))

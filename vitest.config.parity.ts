import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * クライアント間整合のテストの設定（`docs/adr/0010-testing.md`
 * 「クライアント間の整合をどう固定するか」）。
 *
 * **`tests/` に置くのは、`adapter/web` と `adapter/discord` の両方を import するためである。**
 * 対象が 1 つの層に定まらないテストだけが層の外に出る。**テストファイルも依存方向の検査の
 * 対象に含める**（`docs/adr/0010`）ため、`src/usecase/` の隣には置けない。
 *
 * 設定を単体テスト（`vitest.config.ts`）と分けてあるのは、**単体テストが何も起動せずに回る
 * 状態を保つ**ためで、永続化テスト（`vitest.config.db.ts`）と同じ理由である。
 */

/** `.env.local` などのファイルを読む。**実際の環境変数がファイルより優先される。** */
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
    include: ['tests/client-parity/**/*.test.ts'],
    env: fileEnv(mode),
    // 同じ DB を共有し、run のたびに中身を空にするため、並走させない。
    fileParallelism: false,
    testTimeout: 30_000,
  },
}))

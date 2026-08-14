import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 単体テストの設定。
 *
 * `tests/` は層をまたぐテスト（クライアント間整合・E2E）の置き場で、
 * どちらもローカル Postgres を必要とするため、ここには含めない。
 * 単体テストは何も起動せずに回る（`docs/adr/0010-testing.md`）。
 *
 * **同じ理由で `*.db.test.ts` も外す。** 永続化テストは対象の隣に置くが、ローカル Postgres が要る。
 * 設定は `vitest.config.db.ts`。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'app/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.db.test.ts'],
  },
})

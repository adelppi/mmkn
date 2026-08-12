import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 単体テストの設定。
 *
 * `tests/` は層をまたぐテスト（クライアント間整合・E2E）の置き場で、
 * どちらもローカル Postgres を必要とするため、ここには含めない。
 * 単体テストは何も起動せずに回る（`docs/adr/0010-testing.md`）。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'app/**/*.test.{ts,tsx}'],
  },
})

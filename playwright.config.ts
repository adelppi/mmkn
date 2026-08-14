import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { E2E_DISCORD_PUBLIC_KEY } from './tests/e2e/support/discord-key'

/**
 * E2E の設定（`docs/adr/0010-testing.md`「E2E の範囲」・`docs/adr/0011-ci-and-release.md`）。
 *
 * **回す先は、使い捨ての Postgres と、ここで起動したアプリだけである。**
 * 本番にも、本番の認証基盤にも繋がない。
 *
 * ```
 * DATABASE_URL      使い捨ての Postgres（ループバック以外は下ごしらえが弾く）
 * E2E_AUTH_STUB     偽の認証に切り替える（src/infra/auth/stub.ts）
 * DISCORD_PUBLIC_KEY E2E が自分で署名するための鍵（tests/e2e/support/discord-key.ts）
 * ```
 *
 * **E2E は PR では回さない**（`docs/adr/0011`「PR で回すもの」）。手元では必要なときだけ、
 * CI では main へのマージ時にだけ走る。
 */

/** `.env.local` などのファイルを読む。**実際の環境変数がファイルより優先される。** */
const fileEnv = (mode: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(loadEnv(mode, process.cwd(), '')).map(([key, value]) => [
      key,
      process.env[key] ?? value,
    ]),
  )

const env = fileEnv(process.env.NODE_ENV ?? 'development')

// **下ごしらえ（`globalSetup`）も同じ接続先を読む。** ここで置かないと、手元でだけ
// `.env.local` が届かず、CI と手元で挙動が変わる。
process.env.DATABASE_URL ??= env.DATABASE_URL

/**
 * 開発サーバー（3000）と別の口で起動する。**手元で開発サーバーを止めずに回せる。**
 *
 * **`localhost` で揃える。** 起動したアプリがリダイレクト先の origin を自分の名前から組み立てる
 * ため、別名（`127.0.0.1`）で開くと、ログインの往復の途中で origin が変わり cookie が届かなくなる。
 */
const PORT = 3100
const origin = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  // 同じ DB を共有し、回るたびに中身を空にするため、並走させない（永続化テストと同じ理由）。
  workers: 1,
  fullyParallel: false,
  // **失敗を握りつぶさない。** 再試行で通ったものを緑にしない（`docs/adr/0014-logging.md` と同じ姿勢）。
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  globalSetup: './tests/e2e/support/global-setup.ts',
  use: { baseURL: origin, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    // **本番と同じ形で起動する**（開発サーバーではない）。E2E が見るのはビルドされたアプリ。
    command: `npm run build && npx next start --port ${PORT}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // 下ごしらえと同じ接続先を、起動するアプリにも渡す（手元は `.env.local`、CI は
      // ワークフローが渡す使い捨ての Postgres）。
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      E2E_AUTH_STUB: '1',
      DISCORD_PUBLIC_KEY: E2E_DISCORD_PUBLIC_KEY,
    },
  },
})

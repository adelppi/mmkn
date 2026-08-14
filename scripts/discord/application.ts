import type { DiscordApplication } from '../../src/infra/discord/client'

/**
 * 登録と診断が読む設定（`docs/operations.md`「環境変数」）。
 *
 * **この 2 つはホスティング環境に置かない**（`docs/adr/0011-ci-and-release.md`「秘密情報の置き場」）。
 * 署名検証は公開鍵で行うため、アプリは Bot Token を必要としない。読むのは
 * リリースの自動処理と、手元から走らせる道具だけである。
 */
const required = (name: 'DISCORD_APPLICATION_ID' | 'DISCORD_BOT_TOKEN'): string => {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`${name} が設定されていない（docs/operations.md「環境変数」）`)
  }
  return value
}

export const application = (): DiscordApplication => ({
  applicationId: required('DISCORD_APPLICATION_ID'),
  botToken: required('DISCORD_BOT_TOKEN'),
})

import type {
  APIActionRowComponent,
  APIComponentInMessageActionRow,
  APIEmbed,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord-api-types/v10'

/**
 * Discord の API を叩く（`docs/adr/0006-discord-http-interactions.md`）。
 *
 * **HTTP を行うのはこの層だけである。** アダプタ層は「3 秒以内に返す応答」と
 * 「応答後に送るもの」を値として組み立てるだけで、送信は知らない
 * （`docs/adr/0004-layers-and-dependencies.md`）。
 *
 * **follow-up の送信に Bot Token は要らない。** Interaction のトークンが認証を兼ねる。
 * Bot Token が要るのはコマンドの登録だけであり、それはリリースの自動処理と手元からしか
 * 走らない（`docs/adr/0011-ci-and-release.md`「秘密情報の置き場」）。
 */

const API = 'https://discord.com/api/v10'

/** Discord が受け付けなかった。**中身は持ち出さず、機械が読む区分だけを持つ。** */
export class DiscordApiError extends Error {
  constructor(readonly status: number) {
    super(`Discord API が ${status} を返した`)
    this.name = 'DiscordApiError'
  }
}

const request = async (input: {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT'
  readonly url: string
  readonly token?: string
  readonly body?: unknown
}): Promise<unknown> => {
  const response = await fetch(input.url, {
    method: input.method,
    headers: {
      'content-type': 'application/json',
      ...(input.token === undefined ? {} : { authorization: `Bot ${input.token}` }),
    },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  })

  // **握りつぶさない**（`docs/adr/0014-logging.md`）。follow-up の送信に失敗しても
  // 利用者からは何も見えないため、ここで落として `threw` としてログに残す。
  if (!response.ok) throw new DiscordApiError(response.status)

  return response.status === 204 ? undefined : await response.json()
}

/**
 * 応答を返したあとの本文を送る（`docs/adr/0006`「エンドポイントの要件」）。
 *
 * | 行き先 | HTTP |
 * |---|---|
 * | `original` | `PATCH .../messages/@original`（deferred の「考え中」や、押されたメッセージを差し替える） |
 * | `aside` | `POST .../`（**実行者のみ**の別メッセージ。元のメッセージには触れない） |
 */
export type FollowUpMessage = {
  readonly target: 'original' | 'aside'
  readonly embeds: readonly APIEmbed[]
  readonly components: readonly APIActionRowComponent<APIComponentInMessageActionRow>[]
}

export const sendFollowUp = async (input: {
  readonly applicationId: string
  readonly interactionToken: string
  readonly message: FollowUpMessage
}): Promise<void> => {
  const base = `${API}/webhooks/${input.applicationId}/${input.interactionToken}`
  const { embeds, components } = input.message

  if (input.message.target === 'original') {
    await request({
      method: 'PATCH',
      url: `${base}/messages/@original`,
      // **`components` を必ず送る。** 省いたフィールドは変更されず、古いボタンが残る（`docs/adr/0006`）。
      body: { embeds, components },
    })
    return
  }

  await request({
    method: 'POST',
    url: base,
    // 実行者のみ（`docs/adr/0006`「返信の可視性」）。
    body: { embeds, components, flags: 64 },
  })
}

// ── コマンドの登録と、その確認（`docs/operations.md`「診断」）──────────────────

export type DiscordApplication = {
  readonly applicationId: string
  readonly botToken: string
}

/** Discord に登録されているコマンドを読む。**差分の診断が使う。** */
export const listRegisteredCommands = async (
  application: DiscordApplication,
): Promise<readonly unknown[]> => {
  const registered = await request({
    method: 'GET',
    url: `${API}/applications/${application.applicationId}/commands`,
    token: application.botToken,
  })

  return Array.isArray(registered) ? registered : []
}

/**
 * コマンドを登録する。**宣言にあるものが、そのまま登録される全体になる**（総入れ替え）。
 *
 * グローバル登録は反映まで最大 1 時間かかる（`docs/adr/0006`「コマンド登録の運用」）。
 */
export const registerCommands = async (
  application: DiscordApplication,
  commands: readonly RESTPostAPIChatInputApplicationCommandsJSONBody[],
): Promise<void> => {
  await request({
    method: 'PUT',
    url: `${API}/applications/${application.applicationId}/commands`,
    token: application.botToken,
    body: commands,
  })
}

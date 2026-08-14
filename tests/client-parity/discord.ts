import type {
  APIActionRowComponent,
  APIButtonComponentWithCustomId,
  APIComponentInMessageActionRow,
  APIInteraction,
  APIModalInteractionResponseCallbackData,
  APISelectMenuOption,
} from 'discord-api-types/v10'
import { MEMBER_OPTIONS_FIELD } from '@/src/adapter/discord/definitions'
import { COMPONENT, RESPONSE } from '@/src/adapter/discord/protocol'
import { route, type DiscordUseCases, type FollowUp } from '@/src/adapter/discord/router'
import type { Reply } from '@/src/adapter/discord/presenter/reply'
import { verifySignature } from '@/src/infra/discord/signature'
import { environment } from './harness'

/**
 * Discord の入口から操作を流す（`docs/adr/0010-testing.md`
 * 「クライアント間の整合をどう固定するか」の ②）。
 *
 * **署名を作って検証してから振り分ける。** 署名検証は Discord からの操作の認証そのもの
 * （`docs/adr/0006-discord-http-interactions.md`）であり、そこを飛ばして流すと、
 * 実際の入口とは違う経路をテストすることになる。
 *
 * **エンドポイント（`app/api/discord/route.ts`）そのものは通さない。** 署名付きリクエストを
 * HTTP でエンドポイントへ投げる分は E2E の範囲（`docs/adr/0010`「E2E の範囲」）で、
 * このテストが見るのは「同じ操作が同じ記録になること」である。
 */

const TIMESTAMP = '1786000000'

/** Discord のアプリケーションの鍵の代わり。**本物の秘密鍵は Discord 側にしかない。** */
export type Signer = {
  readonly publicKey: string
  readonly sign: (message: string) => Promise<string>
}

const toHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

export const signer = async (): Promise<Signer> => {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair

  return {
    publicKey: toHex(await crypto.subtle.exportKey('raw', pair.publicKey)),
    sign: async (message) =>
      toHex(
        await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(message)),
      ),
  }
}

const CHANNEL = 'channel-parity'

const envelope = (discordUserId: string) => ({
  id: 'interaction',
  application_id: 'application',
  token: 'interaction-token',
  version: 1,
  channel: { id: CHANNEL },
  member: { user: { id: discordUserId } },
})

export const commandInteraction = (input: {
  readonly by: string
  readonly name: string
  readonly options?: readonly unknown[]
}): APIInteraction =>
  ({
    ...envelope(input.by),
    type: 2,
    data: {
      id: 'command',
      name: 'mmkn',
      type: 1,
      options: [{ type: 1, name: input.name, options: input.options ?? [] }],
    },
  }) as unknown as APIInteraction

export const componentInteraction = (input: {
  readonly by: string
  readonly customId: string
  readonly values?: readonly string[]
  readonly message?: unknown
}): APIInteraction =>
  ({
    ...envelope(input.by),
    type: 3,
    message: input.message ?? {},
    data: {
      custom_id: input.customId,
      component_type: input.values === undefined ? 2 : 3,
      ...(input.values === undefined ? {} : { values: [...input.values] }),
    },
  }) as unknown as APIInteraction

/**
 * モーダルの送信。
 *
 * **返す形は、送ったモーダルの形に合わせる。** 入力部品は `LABEL` に包まれて届く
 * （`docs/adr/0006`「構造上の制約」）。
 */
export const modalInteraction = (input: {
  readonly by: string
  readonly customId: string
  readonly texts?: Readonly<Record<string, string>>
  readonly selections?: Readonly<Record<string, readonly string[]>>
}): APIInteraction =>
  ({
    ...envelope(input.by),
    type: 5,
    data: {
      custom_id: input.customId,
      components: [
        ...Object.entries(input.texts ?? {}).map(([name, value]) => ({
          type: COMPONENT.label,
          component: { type: COMPONENT.textInput, custom_id: name, value },
        })),
        ...Object.entries(input.selections ?? {}).map(([name, values]) => ({
          type: COMPONENT.label,
          component: { type: COMPONENT.stringSelect, custom_id: name, values: [...values] },
        })),
      ],
    },
  }) as unknown as APIInteraction

export type Dispatched = {
  readonly modal: APIModalInteractionResponseCallbackData | undefined
  readonly followUp: FollowUp | undefined
}

/**
 * 署名を検証してから振り分け、応答後の処理まで走らせる。
 *
 * 実際の入口では follow-up の送信は応答を返したあとに走るが（`docs/adr/0003-tech-stack.md`）、
 * ここでは結果を見たいので待つ。
 */
export const dispatch = async (input: {
  readonly usecases: DiscordUseCases
  readonly signer: Signer
  readonly interaction: APIInteraction
}): Promise<Dispatched> => {
  const body = JSON.stringify(input.interaction)

  const verified = await verifySignature({
    publicKey: input.signer.publicKey,
    signature: await input.signer.sign(`${TIMESTAMP}${body}`),
    timestamp: TIMESTAMP,
    body,
  })
  if (!verified) throw new Error('署名検証が通らなかった')

  const outcome = route(input.usecases, environment)(JSON.parse(body) as APIInteraction)
  if (outcome === undefined) throw new Error('扱えない Interaction')

  return {
    modal:
      outcome.response.type === RESPONSE.modal
        ? (outcome.response.data as APIModalInteractionResponseCallbackData)
        : undefined,
    followUp: outcome.followUp === undefined ? undefined : await outcome.followUp(),
  }
}

// ── 返ってきたものから、次の操作に要る値を取り出す ─────────────────────────────

const rows = (reply: Reply): readonly APIActionRowComponent<APIComponentInMessageActionRow>[] =>
  reply.components

export const buttonsOf = (reply: Reply): readonly APIButtonComponentWithCustomId[] =>
  rows(reply).flatMap((row) =>
    row.components.flatMap((component) =>
      component.type === COMPONENT.button && 'custom_id' in component ? [component] : [],
    ),
  )

/** メッセージに載って運ばれてきた Member の候補（`docs/adr/0006`「負担者の選択と…」）。 */
export const carriedMembersOf = (reply: Reply): readonly APISelectMenuOption[] =>
  rows(reply).flatMap((row) =>
    row.components.flatMap((component) =>
      component.type === COMPONENT.stringSelect && component.custom_id === MEMBER_OPTIONS_FIELD
        ? component.options
        : [],
    ),
  )

/** モーダルの中のセレクトの候補。 */
export const modalChoicesOf = (
  modal: APIModalInteractionResponseCallbackData,
  name: string,
): readonly APISelectMenuOption[] => {
  for (const slot of modal.components) {
    if (slot.type !== COMPONENT.label) continue
    const component = slot.component
    if (component.type !== COMPONENT.stringSelect) continue
    if (component.custom_id !== name) continue

    return component.options
  }
  return []
}

/** 表示名から Member の識別子を引く。**画面に出ている名前で選ぶ、という操作をそのまま写す。** */
export const chosen = (options: readonly APISelectMenuOption[], label: string): string => {
  const found = options.find((option) => option.label === label)
  if (found === undefined) throw new Error(`候補に「${label}」が無い`)
  return found.value
}

import type { APIInteraction, APIInteractionResponse } from 'discord-api-types/v10'
import { accountOf, placeOf, type DiscordContext } from './context'
import {
  CURRENCY_OPTION_NAME,
  modals,
  parseCustomId,
  subcommands,
  type SubcommandName,
  type Visibility,
} from './definitions'
import { EPHEMERAL_FLAG, INTERACTION, RESPONSE } from './protocol'
import { focusedValue, modalValues, selectedValues, subcommandOf } from './payload'
import { link, unlink, type PlaceCommandUseCases } from './controller/command/place'
import {
  openPaymentInput,
  openTransferInput,
  type RecordCommandUseCases,
} from './controller/command/record'
import {
  balance,
  settlement,
  type SettlementCommandUseCases,
} from './controller/command/settlement'
import {
  openPaymentModal,
  openTransferModal,
} from './controller/component/open-input'
import { assign, pickGroup, type AssignComponentUseCases } from './controller/component/place'
import { settle, type SettleUseCases } from './controller/component/settle'
import { createGroup, type CreateGroupUseCases } from './controller/modal/create-group'
import {
  registerPayment,
  registerTransfer,
  type RecordModalUseCases,
} from './controller/modal/record'
import { currencyChoices } from './presenter/currency'
import { createGroupModal } from './presenter/modal'
import { notice, type Reply } from './presenter/reply'

/**
 * Interaction 種別で分岐する（`docs/adr/0006-discord-http-interactions.md`
 * 「扱う Interaction 種別と、defer の適用範囲」）。
 *
 * **扱うのは 5 種だけである。**
 *
 * | 種別 | 応答 | defer |
 * |---|---|---|
 * | `PING` | `PONG` のみ | **できない**。即座に返す |
 * | `APPLICATION_COMMAND` | メッセージ、またはモーダル | メッセージならする。モーダルは**できない** |
 * | `MESSAGE_COMPONENT` | メッセージ、またはモーダル | 同上 |
 * | `APPLICATION_COMMAND_AUTOCOMPLETE` | 候補リストのみ | **できない**（deferred 形が存在しない） |
 * | `MODAL_SUBMIT` | メッセージ | する |
 *
 * **ここは HTTP を行わない。** 3 秒以内に返す応答と、応答後に続ける処理を**値として返すだけ**で、
 * 実際の送信は入口（`app/api/discord/route.ts`）が `infra/discord` を使って行う
 * （`docs/adr/0004-layers-and-dependencies.md`：アダプタ層はフレームワークにも実行環境にも依存しない）。
 */

export type DiscordUseCases = PlaceCommandUseCases &
  RecordCommandUseCases &
  SettlementCommandUseCases &
  AssignComponentUseCases &
  SettleUseCases &
  CreateGroupUseCases &
  RecordModalUseCases

/** 入口だけが知っている値。**アダプタ層は実行環境を知らない。** */
export type Environment = {
  readonly origin: string
  /** 発生日の初期値（`context.ts` の `today`）。 */
  readonly today: string
}

/**
 * 応答を返したあとに送るもの。
 *
 * | 行き先 | 何が起きるか |
 * |---|---|
 * | `original` | deferred の「考え中」、または押されたメッセージそのものを差し替える |
 * | `aside` | **元のメッセージには触れず**、押下者だけに別の 1 通を送る |
 *
 * `aside` があるのは、公開のメッセージに付いたボタンを Member でない人が押したときに、
 * 全員が見ている表示を消さないためである（`controller/component/settle.ts`）。
 */
export type FollowUp = {
  readonly target: 'original' | 'aside'
  readonly reply: Reply
}

export type Outcome = {
  /** 3 秒以内に返すもの。 */
  readonly response: APIInteractionResponse
  /** 応答後に続ける処理。**無い種別（`PING` など）では省く。** */
  readonly followUp?: () => Promise<FollowUp>
}

/**
 * deferred response。**可視性はここで確定する**（`docs/adr/0006`「返信の可視性」）。
 * 後から変えられないため、宣言の値をそのまま使う。
 */
const deferMessage = (visibility: Visibility): APIInteractionResponse => ({
  type: RESPONSE.deferredMessage,
  data: visibility === 'ephemeral' ? { flags: EPHEMERAL_FLAG } : {},
})

/** 元のメッセージを差し替える形の deferred。**それ自身は可視性を持たない。** */
const deferUpdate = (): APIInteractionResponse => ({ type: RESPONSE.deferredUpdate })

const replacing = (run: () => Promise<Reply>) => async (): Promise<FollowUp> => ({
  target: 'original',
  reply: await run(),
})

const contextOf = (
  interaction: APIInteraction,
  environment: Environment,
): DiscordContext | undefined => {
  const account = accountOf(interaction)
  const place = placeOf(interaction)
  if (account === undefined || place === undefined) return undefined

  return { account, place, origin: environment.origin, today: environment.today }
}

/** 場もユーザーも読めない Interaction。**mmkn が扱える形になっていない。** */
const unreadable = (): Outcome => ({
  response: deferMessage('ephemeral'),
  followUp: replacing(async () =>
    notice(
      'この場所では使えません',
      'mmkn の操作は、チャンネルの中から実行してください。',
    ),
  ),
})

const unknownCommand = (): Outcome => ({
  response: deferMessage('ephemeral'),
  followUp: replacing(async () =>
    notice(
      '知らないコマンドです',
      'コマンドの登録が古い可能性があります。しばらくしてからやり直してください。',
    ),
  ),
})

// ── スラッシュコマンド ────────────────────────────────────────────────────────

const routeCommand = (
  deps: DiscordUseCases,
  interaction: APIInteraction,
  environment: Environment,
): Outcome => {
  if (interaction.type !== INTERACTION.applicationCommand) return unknownCommand()

  const subcommand = subcommandOf(interaction)
  if (subcommand === undefined || !Object.hasOwn(subcommands, subcommand.name)) {
    return unknownCommand()
  }

  const name = subcommand.name as SubcommandName
  const declaration = subcommands[name]

  // **モーダルは defer できない。** 組み立てに永続化を混ぜないため、その場で返しきれる。
  if (declaration.opens.kind === 'modal') {
    return { response: { type: RESPONSE.modal, data: createGroupModal() } }
  }

  const context = contextOf(interaction, environment)
  if (context === undefined) return unreadable()

  const options = subcommand.options
  const run = (): Promise<Reply> => {
    switch (name) {
      case 'link':
        return link(deps)(context)
      case 'unlink':
        return unlink(deps)(context)
      case 'payment':
        return openPaymentInput(deps)(context, options)
      case 'transfer':
        return openTransferInput(deps)(context, options)
      case 'balance':
        return balance(deps)(context)
      case 'settlement':
        return settlement(deps)(context)
      // `create` は上でモーダルとして返している。
      case 'create':
        return Promise.resolve(
          notice('入力をひらけませんでした', 'もう一度お試しください。'),
        )
    }
  }

  return { response: deferMessage(declaration.opens.visibility), followUp: replacing(run) }
}

// ── メッセージ部品 ────────────────────────────────────────────────────────────

const routeComponent = (
  deps: DiscordUseCases,
  interaction: APIInteraction,
  environment: Environment,
): Outcome => {
  if (interaction.type !== INTERACTION.messageComponent) return unknownCommand()

  const parsed = parseCustomId(interaction.data.custom_id)
  if (parsed === undefined) return unknownCommand()

  // **モーダルを開く応答は defer できない。** ここは同期で、ユースケースを呼ばない。
  if (parsed.name === 'open-payment') {
    return { response: { type: RESPONSE.modal, data: openPaymentModal(interaction, parsed.args) } }
  }
  if (parsed.name === 'open-transfer') {
    return { response: { type: RESPONSE.modal, data: openTransferModal(interaction, parsed.args) } }
  }

  const context = contextOf(interaction, environment)
  if (context === undefined) return unreadable()

  switch (parsed.name) {
    case 'pick-group':
      return {
        response: deferUpdate(),
        followUp: replacing(() => pickGroup(deps)(context, selectedValues(interaction))),
      }
    case 'assign':
      return {
        response: deferUpdate(),
        followUp: replacing(() => assign(deps)(context, parsed.args)),
      }
    case 'settle':
      return {
        response: deferUpdate(),
        followUp: async () => {
          const outcome = await settle(deps)(context, parsed.args)
          // **Member でない人が押しても、全員が見ている清算案は消さない**
          // （`controller/component/settle.ts` の `aside`）。
          return {
            target: outcome.kind === 'replace' ? 'original' : 'aside',
            reply: outcome.reply,
          }
        },
      }
    default:
      return unknownCommand()
  }
}

// ── モーダル ─────────────────────────────────────────────────────────────────

const routeModal = (
  deps: DiscordUseCases,
  interaction: APIInteraction,
  environment: Environment,
): Outcome => {
  if (interaction.type !== INTERACTION.modalSubmit) return unknownCommand()

  const parsed = parseCustomId(interaction.data.custom_id)
  if (parsed === undefined || !Object.hasOwn(modals, parsed.name)) return unknownCommand()

  const declaration = modals[parsed.name as keyof typeof modals]

  const context = contextOf(interaction, environment)
  if (context === undefined) return unreadable()

  const values = modalValues(interaction)
  const args = parsed.args

  const run = (): Promise<Reply> => {
    switch (parsed.name as keyof typeof modals) {
      case 'create-group':
        return createGroup(deps)(context, values)
      case 'payment':
        return registerPayment(deps)(context, values, args)
      case 'transfer':
        return registerTransfer(deps)(context, values, args)
    }
  }

  return { response: deferMessage(declaration.visibility), followUp: replacing(run) }
}

// ── オートコンプリート ────────────────────────────────────────────────────────

/**
 * 候補を 3 秒以内に返しきる。**deferred 形が存在しない。**
 *
 * **候補の生成に永続化への問い合わせを含めない**（`docs/adr/0006`）。
 * 通貨の候補は `domain/money` のコミット済みの表から静的に絞り込む（`presenter/currency.ts`）。
 */
const routeAutocomplete = (interaction: APIInteraction): Outcome => {
  if (interaction.type !== INTERACTION.autocomplete) return unknownCommand()

  const focused = focusedValue(interaction)
  const choices =
    focused === undefined || focused.name !== CURRENCY_OPTION_NAME
      ? []
      : currencyChoices(focused.typed)

  return { response: { type: RESPONSE.autocompleteResult, data: { choices: [...choices] } } }
}

// ── 入口 ─────────────────────────────────────────────────────────────────────

/**
 * Interaction を、3 秒以内の応答と応答後の処理に振り分ける。
 *
 * **扱わない種別には `undefined` を返す。** 知らないものに「考え中」を返しても、
 * 続きが来ないまま残るだけである（入口が拒む）。
 */
export const route =
  (deps: DiscordUseCases, environment: Environment) =>
  (interaction: APIInteraction): Outcome | undefined => {
    switch (interaction.type) {
      case INTERACTION.ping:
        return { response: { type: RESPONSE.pong } }
      case INTERACTION.applicationCommand:
        return routeCommand(deps, interaction, environment)
      case INTERACTION.messageComponent:
        return routeComponent(deps, interaction, environment)
      case INTERACTION.autocomplete:
        return routeAutocomplete(interaction)
      case INTERACTION.modalSubmit:
        return routeModal(deps, interaction, environment)
      default:
        return undefined
    }
  }

import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord-api-types/v10'
import { COMMAND_TYPE, OPTION_TYPE } from './protocol'

/**
 * コマンド・メッセージ部品・モーダルの宣言（`docs/adr/0006-discord-http-interactions.md`）。
 *
 * **ここがソース上の唯一の正である。** 登録スクリプトも、受信時の分岐も、可視性の決定も、
 * 定義との差分を出す診断も、すべてこの宣言を読む。**2 か所に割らない。**
 *
 * メッセージ部品とモーダルは Discord への登録を伴わないが、**可視性の宣言単位**であることは
 * コマンドと同じであるため、同じ場所に置く（`docs/adr/0006`「コマンド登録の運用」）。
 */

// ── 可視性 ───────────────────────────────────────────────────────────────────

/**
 * 返信の可視性（`docs/adr/0006`「返信の可視性」）。
 *
 * **deferred response の可視性は後から変えられない。** そのため可視性は
 * **defer を開始する単位**（スラッシュコマンド／メッセージ部品／モーダル）ごとの宣言として持ち、
 * **defer の時点で使う。** 1 つの Interaction の中で返信ごとに選ぶことはできない。
 */
export type Visibility = 'public' | 'ephemeral'

/**
 * その単位が、3 秒以内に何を返すか。
 *
 * | 種類 | 応答 | 可視性 |
 * |---|---|---|
 * | `message` | 新しいメッセージを送る deferred | 宣言で持つ |
 * | `update` | 元のメッセージを差し替える deferred | **持たない**（元のメッセージのものを引き継ぐ） |
 * | `modal` | モーダルを開く。**defer できない** | 持たない（モーダル自身は可視性を持たない） |
 *
 * `update` が可視性を持たないのは、差し替える先が既にあるメッセージだからである。
 * `modal` が持たないのは、モーダルが開いた本人にしか見えないためで、宣言が要るのは
 * その `MODAL_SUBMIT` の側になる（下の `modals`）。
 */
export type Opening =
  | { readonly kind: 'message'; readonly visibility: Visibility }
  | { readonly kind: 'update' }
  | { readonly kind: 'modal' }

// ── スラッシュコマンド ────────────────────────────────────────────────────────

/**
 * トップレベルのコマンド名。**操作はすべてこの下のサブコマンドとして生える。**
 *
 * `/payment` のような一般的な名前でコマンド一覧を占めないため、入口を 1 つにまとめてある。
 * **名前は英語、説明は日本語。** スマホで IME を切り替えずに絞り込めるようにするため。
 */
export const COMMAND_NAME = 'mmkn'

const COMMAND_DESCRIPTION = 'グループのお金の動きを記録し、清算案を出す'

/** 通貨の引数。**候補はオートコンプリートで返す**（`presenter/currency.ts`）。 */
const CURRENCY_OPTION = {
  type: OPTION_TYPE.string,
  name: 'currency',
  description: '通貨コード（省略するとグループの既定通貨）',
  required: false,
  autocomplete: true,
} as const

/** 通貨の引数を持つサブコマンドで、その値を読むときの名前。 */
export const CURRENCY_OPTION_NAME = CURRENCY_OPTION.name

export type SubcommandName =
  | 'create'
  | 'link'
  | 'unlink'
  | 'payment'
  | 'transfer'
  | 'balance'
  | 'settlement'

type SubcommandDeclaration = {
  readonly description: string
  readonly options: readonly (typeof CURRENCY_OPTION)[]
  readonly opens: Opening
}

/**
 * サブコマンドの宣言。
 *
 * **可視性の使い分けは `docs/adr/0006`「返信の可視性」の表を正とする。**
 *
 * | 返信の種別 | 可視性 | ここでの単位 |
 * |---|---|---|
 * | 支払い・送金の登録結果 | 公開 | `modals` の `payment` / `transfer` |
 * | 収支・清算案 | 公開 | `balance` / `settlement` |
 * | 入力途中のやり取り | 実行者のみ | `payment` / `transfer` / `link` |
 * | 場と Group の対応づけ・解除の結果 | 実行者のみ | `unlink` と、部品の `link-pick` / `assign` |
 * | グループの作成結果（参加リンクを含む） | 実行者のみ | `modals` の `create` |
 *
 * **支払いと送金は、コマンドとモーダルで単位が分かれる。** 入力途中は実行者のみ、
 * 確定した結果は公開、が成立するのはこのためである（`docs/adr/0006`）。
 */
export const subcommands = {
  create: {
    description: 'グループを作る',
    options: [],
    // モーダルは永続化に問い合わせずに組み立てられる（グループ名と既定通貨だけ）。
    opens: { kind: 'modal' },
  },
  link: {
    description: 'このチャンネルにグループを対応づける',
    options: [],
    opens: { kind: 'message', visibility: 'ephemeral' },
  },
  unlink: {
    description: 'このチャンネルとグループの対応を解除する',
    options: [],
    opens: { kind: 'message', visibility: 'ephemeral' },
  },
  payment: {
    description: '支払いを記録する',
    options: [CURRENCY_OPTION],
    // **入力途中のやり取り。** 負担者の候補を載せたメッセージを実行者だけに返す。
    opens: { kind: 'message', visibility: 'ephemeral' },
  },
  transfer: {
    description: '送金を記録する',
    options: [CURRENCY_OPTION],
    opens: { kind: 'message', visibility: 'ephemeral' },
  },
  balance: {
    description: '収支を見る',
    options: [],
    opens: { kind: 'message', visibility: 'public' },
  },
  settlement: {
    description: '清算案を見る（送金を記録するボタンが付く）',
    options: [],
    opens: { kind: 'message', visibility: 'public' },
  },
} as const satisfies Record<SubcommandName, SubcommandDeclaration>

/**
 * Discord へ登録する定義。**登録スクリプトと差分の診断はこれを読む**（`scripts/discord/`）。
 *
 * 宣言から組み立てるため、**宣言を直せば登録される定義も診断の基準も同時に変わる。**
 */
export const applicationCommand = (): RESTPostAPIChatInputApplicationCommandsJSONBody => ({
  name: COMMAND_NAME,
  type: COMMAND_TYPE.chatInput,
  description: COMMAND_DESCRIPTION,
  options: Object.entries(subcommands).map(([name, declaration]) => ({
    type: OPTION_TYPE.subcommand,
    name,
    description: declaration.description,
    options: declaration.options.map((option) => ({ ...option })),
  })),
})

// ── メッセージ部品 ────────────────────────────────────────────────────────────

/**
 * メッセージ部品の宣言。**鍵が `custom_id` の接頭辞になる**（下の `customId`）。
 *
 * `open-payment` / `open-transfer` がモーダルを開く。**この 2 つだけは defer による救済が
 * 効かない**ため、組み立てに永続化を混ぜない（候補は Interaction のペイロードから復元する。
 * `presenter/modal.ts`）。
 */
export type ComponentName = 'open-payment' | 'open-transfer' | 'pick-group' | 'assign' | 'settle'

export const components = {
  'open-payment': { opens: { kind: 'modal' } },
  'open-transfer': { opens: { kind: 'modal' } },
  /** グループを選んで、このチャンネルに対応づける。選び終えた時点で確定する。 */
  'pick-group': { opens: { kind: 'update' } },
  /** 作ったばかりのグループを、このチャンネルに対応づける。 */
  assign: { opens: { kind: 'update' } },
  /**
   * 清算案の「送金した」。
   *
   * **元のメッセージを差し替える**（`docs/adr/0006`「メッセージコンポーネント」）。
   * 登録できたかどうかに関わらず清算案を描き直すため、**古いボタンが残らない。**
   */
  settle: { opens: { kind: 'update' } },
} as const satisfies Record<ComponentName, { readonly opens: Opening }>

// ── モーダル ─────────────────────────────────────────────────────────────────

/**
 * モーダルの宣言。**持つのは `MODAL_SUBMIT` の deferred response の可視性である。**
 *
 * モーダルそのものは可視性を持たない（開いた本人にしか見えない）。
 */
export type ModalName = 'create-group' | 'payment' | 'transfer'

export const modals = {
  /** 参加リンクを含むため実行者のみ。渡す相手は作成者が決める。 */
  'create-group': { visibility: 'ephemeral' },
  /** 登録結果は公開（`docs/adr/0006`「返信の可視性」）。 */
  payment: { visibility: 'public' },
  transfer: { visibility: 'public' },
} as const satisfies Record<ModalName, { readonly visibility: Visibility }>

// ── custom_id ────────────────────────────────────────────────────────────────

/** `custom_id` の上限（`docs/adr/0006`「構造上の制約」）。 */
export const CUSTOM_ID_MAX_LENGTH = 100

const SEPARATOR = ':'

/**
 * `custom_id` を組み立てる。
 *
 * **100 文字に収まらなければ失敗させる。** 切り詰めると、押しても解釈できない部品が
 * 黙って出来上がる（`docs/domain/group.md`「前提条件を満たさなかったとき」の「起きないこと」と
 * 同じ理由で、一部だけ通る形を作らない）。**収まることはテストで固定してある。**
 */
export const customId = (name: ComponentName | ModalName, ...args: readonly string[]): string => {
  const id = [name, ...args].join(SEPARATOR)
  if (id.length > CUSTOM_ID_MAX_LENGTH) {
    throw new RangeError(`custom_id が ${CUSTOM_ID_MAX_LENGTH} 文字を超えた`)
  }
  return id
}

/** `custom_id` を接頭辞と引数に分ける。**知らない接頭辞は `undefined`。** */
export const parseCustomId = (
  raw: string,
): { readonly name: ComponentName | ModalName; readonly args: readonly string[] } | undefined => {
  const [name, ...args] = raw.split(SEPARATOR)
  if (name === undefined) return undefined
  if (!Object.hasOwn(components, name) && !Object.hasOwn(modals, name)) return undefined

  return { name: name as ComponentName | ModalName, args }
}

/** モーダルの中の入力部品の名前。**返ってきた値をこの名前で引く。** */
export const FIELD = {
  groupName: 'group-name',
  defaultCurrency: 'default-currency',
  amount: 'amount',
  payer: 'payer',
  bearers: 'bearers',
  sender: 'sender',
  recipient: 'recipient',
  occurredOn: 'occurred-on',
  description: 'description',
} as const

/**
 * 負担者・送り手・受け手の候補を運ぶ部品の名前。
 *
 * **モーダルを開く応答は永続化に問い合わせられない**（`docs/adr/0006`）。そのため候補は
 * 1 つ前の Interaction（deferred できるコマンド）で引いておき、その返信の中の
 * **押せないセレクト**に載せて運ぶ。押下時の Interaction には元のメッセージが同梱されるため、
 * そこから復元してモーダルに移す。
 */
export const MEMBER_OPTIONS_FIELD = 'members'

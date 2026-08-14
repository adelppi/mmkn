import { describe, expect, it } from 'vitest'
import {
  applicationCommand,
  components,
  customId,
  modals,
  parseCustomId,
  subcommands,
  COMMAND_NAME,
  CUSTOM_ID_MAX_LENGTH,
} from './definitions'

/**
 * コマンド・部品・モーダルの宣言（`docs/adr/0006-discord-http-interactions.md`）。
 *
 * **宣言はソース上の 1 か所にあり、登録スクリプトも受信時の分岐も可視性の決定も同じものを読む。**
 * ここで固定するのは、その宣言が守るべき形である。
 */

/** 実際の識別子と同じ長さ（cuid2・24 文字。`docs/adr/0002-invite-code.md`）。 */
const ID = 'a'.repeat(24)

describe('可視性の宣言', () => {
  it('収支・清算案は公開（docs/adr/0006「返信の可視性」）', () => {
    expect(subcommands.balance.opens).toEqual({ kind: 'message', visibility: 'public' })
    expect(subcommands.settlement.opens).toEqual({ kind: 'message', visibility: 'public' })
  })

  it('支払い・送金の登録結果は公開', () => {
    expect(modals.payment.visibility).toBe('public')
    expect(modals.transfer.visibility).toBe('public')
  })

  it('入力途中のやり取りは実行者のみ', () => {
    expect(subcommands.payment.opens).toEqual({ kind: 'message', visibility: 'ephemeral' })
    expect(subcommands.transfer.opens).toEqual({ kind: 'message', visibility: 'ephemeral' })
    expect(subcommands.link.opens).toEqual({ kind: 'message', visibility: 'ephemeral' })
  })

  it('場と Group の対応づけ・解除の結果は実行者のみ', () => {
    expect(subcommands.unlink.opens).toEqual({ kind: 'message', visibility: 'ephemeral' })
    // 対応づけは、実行者のみのメッセージを差し替える形で返る。
    expect(components['pick-group'].opens).toEqual({ kind: 'update' })
    expect(components.assign.opens).toEqual({ kind: 'update' })
  })

  it('参加リンクを含むグループの作成結果は実行者のみ', () => {
    expect(modals['create-group'].visibility).toBe('ephemeral')
  })

  it('モーダルを開く単位は可視性を持たない（モーダルは開いた本人にしか見えない）', () => {
    expect(subcommands.create.opens).toEqual({ kind: 'modal' })
    expect(components['open-payment'].opens).toEqual({ kind: 'modal' })
    expect(components['open-transfer'].opens).toEqual({ kind: 'modal' })
  })
})

describe('custom_id', () => {
  it('清算案のボタンは、受け手と通貨だけを載せて 100 文字に収まる', () => {
    // **送り手は押下者に固定するため載せない**（`docs/adr/0006`「メッセージコンポーネント」）。
    const id = customId('settle', ID, 'JPY')

    expect(id.length).toBeLessThanOrEqual(CUSTOM_ID_MAX_LENGTH)
  })

  it('入力をひらくボタンは、通貨・発生日の初期値・自分の Member を載せて 100 文字に収まる', () => {
    const id = customId('open-payment', 'JPY', '2026-08-14', ID)

    expect(id.length).toBeLessThanOrEqual(CUSTOM_ID_MAX_LENGTH)
  })

  it('対応づけのボタンは、対象の Group を載せて 100 文字に収まる', () => {
    expect(customId('assign', ID).length).toBeLessThanOrEqual(CUSTOM_ID_MAX_LENGTH)
  })

  it('100 文字を超えたら失敗する。切り詰めて黙って壊れた部品を作らない', () => {
    expect(() => customId('settle', 'x'.repeat(CUSTOM_ID_MAX_LENGTH))).toThrow(RangeError)
  })

  it('組み立てたものを読み戻せる', () => {
    expect(parseCustomId(customId('settle', ID, 'JPY'))).toEqual({
      name: 'settle',
      args: [ID, 'JPY'],
    })
  })

  it('知らない接頭辞は読めない', () => {
    expect(parseCustomId('なにか:1')).toBeUndefined()
  })
})

describe('Discord へ登録する定義', () => {
  const command = applicationCommand()

  it('宣言したサブコマンドがそのまま登録される定義になる', () => {
    expect(command.name).toBe(COMMAND_NAME)
    expect(command.options?.map((option) => option.name).sort()).toEqual(
      Object.keys(subcommands).sort(),
    )
  })

  it('通貨の引数はオートコンプリートで受ける（候補は永続化に問い合わせずに作る）', () => {
    const payment = command.options?.find((option) => option.name === 'payment')
    const currency = 'options' in payment! ? payment.options?.[0] : undefined

    expect(currency).toMatchObject({ name: 'currency', autocomplete: true, required: false })
  })

  it('説明が空のサブコマンドは無い（Discord が拒む）', () => {
    expect(command.options?.every((option) => option.description.length > 0)).toBe(true)
  })
})

/**
 * 構造化ログの出力（`docs/adr/0014-logging.md`）。
 *
 * **標準出力に 1 行 1 JSON を出し、ホスティング環境のログに集約させる。**
 * 監視サービス・エラー通知は持たない。
 *
 * **絶対に出さないもの**（`docs/adr/0014`「絶対に出さないもの」）:
 * 金額・通貨・内容・表示名・グループ名・参加コード・メールアドレス・トークン。
 * **対象を指すときは ID だけを出す。** そのため、ここが受け取れる形をログの項目そのものに絞ってある。
 * 任意の値を渡せる口を作らない。
 */

/** どの提供形態から来た操作か。 */
export type Client = 'web' | 'discord'

/**
 * 1 リクエスト（1 Interaction）で一貫する文脈。
 *
 * **応答を返したあとに続く処理も同じ相関 ID で出す**（`docs/adr/0003-tech-stack.md`）。
 * 「◯時ごろ Discord が無反応だった」という報告から該当の実行を特定できる状態を作るためのもの。
 */
export type LogContext = {
  readonly correlationId: string
  readonly client: Client
}

/**
 * ユースケース 1 回分の記録。
 *
 * `outcome` は 3 つを区別する（`docs/adr/0014`「必ず出すもの」）。
 *
 * - `ok` … 成功
 * - `failed` … `Result` が `ok: false` を返した**想定された失敗**。`failure` に union のタグが入る
 * - `threw` … 例外として抜けた**想定していない失敗**。**これだけが調べる対象になる**
 */
export type UseCaseLog = LogContext & {
  readonly usecase: string
  readonly outcome: 'ok' | 'failed' | 'threw'
  /** 失敗の種類。`Result` の失敗はその union のタグ、例外は種類の名前。**中身は入れない。** */
  readonly failure?: string
  readonly durationMs: number
}

/**
 * 標準出力へ 1 行の JSON として書く。
 *
 * `console` を使うのはこの層だけ。**ドメイン層・ユースケース層に `console` を書かない**
 * （`docs/adr/0014`。依存方向の検査で禁止モジュールとして扱われる）。
 */
export const writeLog = (entry: UseCaseLog): void => {
  console.log(JSON.stringify(entry))
}

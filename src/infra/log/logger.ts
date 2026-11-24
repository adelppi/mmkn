/**
 * 構造化ログの出力（`docs/adr/0014-logging.md`）。
 *
 * **記録の中身を出さない**（同「絶対に出さないもの」）。対象を指すのは ID だけで、
 * 任意の値を渡せる口を作らない。
 */

/** 1 リクエストで一貫する文脈。 */
export type LogContext = {
  readonly correlationId: string
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

/** 標準出力へ 1 行の JSON として書く。**`console` を使うのはこの層だけ**（`docs/adr/0014`）。 */
export const writeLog = (entry: UseCaseLog): void => {
  console.log(JSON.stringify(entry))
}

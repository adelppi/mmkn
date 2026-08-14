import type { UseCase } from '../../usecase/usecase'
import { writeLog, type LogContext } from './logger'

/**
 * ユースケースをログで包む（`docs/adr/0014-logging.md`「どこで出すか」）。
 *
 * **包む形にするのは、ドメイン層・ユースケース層にログの存在を持ち込まないためである。**
 * 合成ルート（`app/_lib/wire.ts`）がこれを使い、ユースケースの中にログ出力を散らさない。
 */

/**
 * 失敗の union のタグを取り出す。
 *
 * **失敗の中身をログに出さない**（`docs/adr/0014`）。失敗の値をそのまま文字列にすると、
 * 将来タグ以外の情報を持つ失敗が現れたときに、記録の中身が漏れる経路になる。
 * ここが読むのは `kind` だけで、それ以外は捨てる。
 */
const failureTag = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'kind' in error && typeof error.kind === 'string'
    ? error.kind
    : 'unknown'

/**
 * 例外の種類の名前を取り出す。
 *
 * **メッセージもスタックも出さない。** ドライバの例外のメッセージには、
 * 書き込もうとした値がそのまま入り得る（`docs/adr/0014`「絶対に出さないもの」）。
 */
const exceptionName = (error: unknown): string =>
  error instanceof Error ? error.name : typeof error

export const logged =
  <I, O, E>(context: LogContext, usecase: string, run: UseCase<I, O, E>): UseCase<I, O, E> =>
  async (input) => {
    const startedAt = Date.now()

    try {
      const result = await run(input)

      writeLog({
        ...context,
        usecase,
        ...(result.ok
          ? { outcome: 'ok' as const }
          : { outcome: 'failed' as const, failure: failureTag(result.error) }),
        durationMs: Date.now() - startedAt,
      })

      return result
    } catch (error) {
      writeLog({
        ...context,
        usecase,
        outcome: 'threw',
        failure: exceptionName(error),
        durationMs: Date.now() - startedAt,
      })

      // **握りつぶさない。** 想定していない失敗は呼び出し元へ抜ける。
      throw error
    }
  }

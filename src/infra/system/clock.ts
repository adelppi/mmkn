import type { Clock } from '../../usecase/port/clock'

/**
 * `Clock` の実装（`docs/adr/0008-layer-internals.md`「識別子の生成」）。
 *
 * ここが実行環境の時計に触れる唯一の場所になる。ドメイン層・ユースケース層は
 * ポート越しにしか現在時刻を受け取らない。
 */
export const systemClock: Clock = {
  now: () => new Date(),
}

/**
 * その時点を `YYYY-MM-DD` として読む。
 *
 * **入力欄の初期値を作るためだけのものである**（`docs/domain/record.md`「発生日」：
 * 初期値であって、日付そのものの意味を決めるものではない）。Web ではブラウザが手元の日付を
 * 入れて送るため、これを使うのは**手元の日付が届かない入口だけ**になる（Discord）。
 *
 * **どの地域の日付として読むかは決めていない**（実行環境の時計をそのまま UTC で読む）。
 * Discord は操作した人の地域を伝えないため、ここで地域を仮定すると、仮定した分だけ
 * 実際とずれる。**未決として `docs/open-questions.md` に登録してある。**
 */
export const isoDateOf = (at: Date): string => at.toISOString().slice(0, 10)

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

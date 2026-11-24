import type { Clock } from '../../usecase/port/clock'

/** `Clock` の実装。 */
export const systemClock: Clock = {
  now: () => new Date(),
}

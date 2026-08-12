import type { Result } from '../domain/result'

/**
 * ユースケースの形。定義の正は `docs/adr/0008-layer-internals.md`。
 *
 * 基底クラスを持たず、形は型エイリアスで揃える。
 * 依存は「`deps` を受けて `UseCase` を返す」規約で受け取る。
 */
export type UseCase<I, O, E> = (input: I) => Promise<Result<O, E>>

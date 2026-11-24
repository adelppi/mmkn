import type { Result } from '../domain/result'

/** ユースケースの形（`docs/adr/0008-layer-internals.md`）。 */
export type UseCase<I, O, E> = (input: I) => Promise<Result<O, E>>

/** 楽観ロックの版。ドメインのエンティティには持たせない（`docs/adr/0005`「同時書き込みの競合」）。 */
export type Version = number

/** 記録と、その版の組。**取得側はこの形で返す**（`docs/adr/0005-data-access-and-authorization.md`）。 */
export type Versioned<T> = {
  readonly record: T
  readonly version: Version
}

/** 版を見た書き込みの結果。見ていた版が既に変わっていれば `stale`。**自動で再試行しない**（`docs/adr/0005`）。 */
export type VersionedWrite =
  | { readonly kind: 'written'; readonly version: Version }
  | { readonly kind: 'stale' }

/** 版を見た削除の結果。`stale` の意味は `VersionedWrite` と同じ。 */
export type VersionedDelete = { readonly kind: 'deleted' } | { readonly kind: 'stale' }

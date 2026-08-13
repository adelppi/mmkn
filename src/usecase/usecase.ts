import type { Result } from '../domain/result'

/**
 * ユースケースの形。定義の正は `docs/adr/0008-layer-internals.md`。
 *
 * 基底クラスを持たず、形は型エイリアスで揃える。
 * 依存は「`deps` を受けて `UseCase` を返す」規約で受け取る。
 */
export type UseCase<I, O, E> = (input: I) => Promise<Result<O, E>>

/**
 * 楽観ロックの版（`docs/glossary.md` の `version`）。
 *
 * **ドメインのエンティティは版を持たない**（`docs/adr/0005-data-access-and-authorization.md`）。
 * 楽観ロックはここで選んだ実現方式にすぎないため、版はユースケースの入出力とポートだけで受け渡す。
 * ここに置くのは、その 2 か所が同じ形を使うためである。
 */
export type Version = number

/** 記録と、その版の組。**取得側はこの形で返す**（`docs/adr/0005-data-access-and-authorization.md`）。 */
export type Versioned<T> = {
  readonly record: T
  readonly version: Version
}

/**
 * 版を見た書き込みの結果。
 *
 * 操作者が見ていた版が既に変わっていれば `stale` を返す。**自動で再試行しない**
 * （`docs/domain/record.md`「同じ記録に同時に手が入ったとき」・`docs/adr/0005`）。
 * 読み直した先は操作者が見ていない内容であり、そこへ変更を適用するのは意図されていない。
 */
export type VersionedWrite =
  | { readonly kind: 'written'; readonly version: Version }
  | { readonly kind: 'stale' }

/** 版を見た削除の結果。`stale` の意味は `VersionedWrite` と同じ。 */
export type VersionedDelete = { readonly kind: 'deleted' } | { readonly kind: 'stale' }

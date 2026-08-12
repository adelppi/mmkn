/**
 * ユースケースの結果を表す型。定義の正は `docs/adr/0008-layer-internals.md`。
 *
 * 失敗は例外ではなく値で返し、分岐の漏れを型検査で落とす。
 * 失敗の型（`E`）はユースケースごとのタグ付き union とし、アプリ全体で 1 つにしない。
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

/** 成功を組み立てる。 */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

/** 失敗を組み立てる。 */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

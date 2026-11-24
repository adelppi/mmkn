import { err, ok, type Result } from '../result'

/** 文字列の入力制約（`docs/domain/group.md` の各属性）。**上限の数値をここ以外に書かない。** */

/** User の名前の上限。表示名の初期値に使うため、表示名と同じ上限にそろえてある。 */
export const USER_NAME_MAX_LENGTH = 20

/** グループ名の上限。 */
export const GROUP_NAME_MAX_LENGTH = 50

/** グループ内表示名の上限。 */
export const DISPLAY_NAME_MAX_LENGTH = 20

/** 制約を満たさなかった理由。項目ごとの失敗の型は、これを項目の名前に写して作る。 */
export type TextViolation = 'empty' | 'tooLong'

/**
 * 前後の空白を落とし、空でないこと・上限を超えないことを確かめる。
 *
 * 長さは符号単位ではなくコードポイントで数える。「20 文字」を、
 * 2 つの符号単位で表される文字（絵文字など）でも 1 文字として扱うため。
 */
export const constrainText = (raw: string, maxLength: number): Result<string, TextViolation> => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return err('empty')
  if ([...trimmed].length > maxLength) return err('tooLong')
  return ok(trimmed)
}

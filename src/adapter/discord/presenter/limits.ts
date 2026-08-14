/**
 * Discord の構造上の制約（`docs/adr/0006-discord-http-interactions.md`「構造上の制約」）。
 *
 * **Discord は上限違反をメッセージ単位で拒否し、原因が分かりにくい。**
 * そのため切り詰めは表示を組み立てる側でまとめて行い、**テストで固定する。**
 *
 * **ここに業務上の上限は無い。** 金額の上限も文字数の上限も `domain/` が正であり
 * （`CLAUDE.md`）、この表にあるのは Discord というクライアント固有の器の大きさだけである。
 */

/** 1 メッセージに置ける ActionRow の数。 */
export const MAX_ROWS = 5

/** 1 つの ActionRow に置けるボタンの数。 */
export const MAX_BUTTONS_PER_ROW = 5

/** 1 メッセージに置けるボタンの数（ボタンだけで埋めたとき）。 */
export const MAX_BUTTONS = MAX_ROWS * MAX_BUTTONS_PER_ROW

/** Embed のフィールドの数。 */
export const MAX_EMBED_FIELDS = 25

/** Embed のフィールド値の長さ。 */
export const MAX_FIELD_VALUE_LENGTH = 1024

/** Embed の説明の長さ。 */
export const MAX_DESCRIPTION_LENGTH = 4096

/**
 * セレクトの候補の数。**オートコンプリートの候補も同じ 25 件。**
 *
 * **Member が 25 人を超えるグループでは、負担者を選びきれない**（`docs/adr/0006`「結果」の留意点）。
 * これは受け入れた制約であり、**回避策を作らない。**
 */
export const MAX_CHOICES = 25

/** 1 枚のモーダルに置ける部品の数（1 部品 1 スロット）。 */
export const MAX_MODAL_COMPONENTS = 5

/** 先頭から `limit` 件だけ残す。**切り詰めた分は黙って落ちる。** */
export const take = <T>(items: readonly T[], limit: number): readonly T[] =>
  items.length <= limit ? items : items.slice(0, limit)

/**
 * 文字数で切り詰める。**溢れた分は末尾を `…` に置き換えて示す。**
 *
 * 長さを符号単位ではなくコードポイントで数えるのは、`src/domain/group/text.ts` と同じ理由
 * （2 つの符号単位で表される文字を 1 文字として扱う）。Discord も同じ数え方をする。
 */
export const clamp = (text: string, limit: number): string => {
  const characters = [...text]
  if (characters.length <= limit) return text

  return `${characters.slice(0, limit - 1).join('')}…`
}

/** ボタンを 1 行 5 個ずつに割り、5 行に収める。**溢れたボタンは落ちる。** */
export const intoRows = <T>(buttons: readonly T[]): readonly (readonly T[])[] => {
  const rows: T[][] = []

  for (const button of take(buttons, MAX_BUTTONS)) {
    const last = rows[rows.length - 1]
    if (last === undefined || last.length === MAX_BUTTONS_PER_ROW) rows.push([button])
    else last.push(button)
  }

  return rows
}

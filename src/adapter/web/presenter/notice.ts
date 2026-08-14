/**
 * 済んだことの知らせ（設計「トースト」）。
 *
 * **何が済んだかだけを持ち、どう見せるかは持たない。** トーストという見せ方は `app/_ui/toast.tsx`
 * にあり、ここが決めるのは文言と印（`tone`）だけである（`docs/adr/0009-web-ui.md`「トースト」）。
 *
 * **取り消しの導線を持たない。** 削除は復元できず、削除履歴も残らない（`docs/domain/record.md`
 * 「削除」）ため、知らせに戻る道を付けると、存在しない機能を指すことになる。この型が文言と印しか
 * 持たないこと自体が、その約束である。
 */

/** 知らせを運ぶ場所（行き先の問い合わせ文字列）。**印だけで、中身は載せない。** */
export const NOTICE_PARAM = 'notice'

/**
 * 印の色（設計「トースト（成功・削除・失敗）」）。
 *
 * **`failed` だけが取り消しのきかない色を持つ**（`app/globals.css`：`--destructive`）。
 */
export type NoticeTone = 'done' | 'removed' | 'failed'

const NOTICES = {
  paymentRecorded: { tone: 'done', message: '支払いを記録しました' },
  transferRecorded: { tone: 'done', message: '送金を記録しました' },
  recordSaved: { tone: 'done', message: '記録を保存しました' },
  recordDeleted: { tone: 'removed', message: '記録を削除しました' },
} as const satisfies Record<string, { readonly tone: NoticeTone; readonly message: string }>

/** 遷移をまたいで運べる知らせ。**ここに載っていない文字列は運べない。** */
export type NoticeTag = keyof typeof NOTICES

export type NoticeView = {
  readonly tone: NoticeTone
  readonly message: string
}

/**
 * 行き先に付いてきた印を、知らせに直す。
 *
 * **読めない印は、知らせが無いのと同じに扱う。** 印は誰でも打てるため、ここが受け取れるのは
 * 上の表に載っている名前だけで、載っていないものからは何も出さない。
 */
export const toNoticeView = (tag: string | undefined): NoticeView | undefined =>
  tag !== undefined && tag in NOTICES ? NOTICES[tag as NoticeTag] : undefined

/**
 * 保存が届かなかったときの知らせ（設計「トースト（失敗）」）。
 *
 * **入力の不備はここに来ない。** それは入力欄の隣に出る（`docs/adr/0009-web-ui.md`
 * 「クライアント側の入力検査」）。ここが受け持つのは、**操作そのものがサーバーへ届かなかった場合**
 * だけである。届いた失敗はユースケースの失敗として戻り、`presenter/message.ts` が文言を持つ。
 */
export const unreachableNotice = (): NoticeView => ({
  tone: 'failed',
  message: '保存できませんでした。通信を確認してもう一度お試しください。',
})

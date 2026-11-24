/**
 * 済んだことの知らせ（`docs/adr/0009-web-ui.md`「トースト」）。**どう見せるかは `app/_ui/toast.tsx` が持つ。**
 *
 * 取り消しの導線は持たない。削除は復元できない（`docs/domain/record.md`「削除」）。
 */

/** 知らせを運ぶ場所（行き先の問い合わせ文字列）。**印だけで、中身は載せない。** */
export const NOTICE_PARAM = 'notice'

/** 印の色。**`failed` だけが取り消しのきかない色を持つ**（`app/globals.css`：`--destructive`）。 */
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

/** 行き先に付いてきた印を、知らせに直す。**読めない印は、知らせが無いのと同じに扱う。** */
export const toNoticeView = (tag: string | undefined): NoticeView | undefined =>
  tag !== undefined && tag in NOTICES ? NOTICES[tag as NoticeTag] : undefined

/**
 * 保存が届かなかったときの知らせ。**操作そのものがサーバーへ届かなかった場合だけ**で、
 * 届いた失敗は `message.ts` が受け持つ。
 */
export const unreachableNotice = (): NoticeView => ({
  tone: 'failed',
  message: '保存できませんでした。通信を確認してもう一度お試しください。',
})

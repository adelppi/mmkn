/**
 * 参加コードを埋め込んだ共有リンク（`docs/domain/group.md`「Group の属性」・`docs/adr/0002-invite-code.md`）。
 *
 * **クライアント固有ではない**（`docs/adr/0008-layer-internals.md`：`adapter/shared`）。
 * 参加の画面を持つのは Web だが、リンクを人に渡すのはどのクライアントからでも起こる。
 * **渡す先が 1 つしかない以上、形もここ 1 か所で持つ。**
 *
 * `docs/domain/group.md` は「参加コードは共有リンクに埋め込んで渡す」「人が目で読んで手で入力する
 * 経路は持たない」と定めている。**参加コードを裸で表示しない。**
 */

/** 共有リンクの path。Web の画面の場所でもある（`src/adapter/web/presenter/route.ts`）。 */
export const invitePath = (inviteCode: string): string => `/j/${inviteCode}`

/** 人に渡す形。`origin` は入口が渡す（アダプタは実行環境を知らない）。 */
export const inviteUrl = (origin: string, inviteCode: string): string =>
  `${origin}${invitePath(inviteCode)}`

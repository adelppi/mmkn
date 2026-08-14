import { invitePath } from '../../shared/invite'
import { NOTICE_PARAM, type NoticeTag } from './notice'

/**
 * 画面の場所（`docs/adr/0009-web-ui.md`）。
 *
 * **ビューモデルに載せるリンクはここで組み立てる。** Presentational は受け取った文字列を
 * `href` に置くだけで、場所を知らない。**識別子を素の文字列で受ける**のは、ビューモデルが
 * シリアライズ可能な素の値だけで構成されるため（`docs/adr/0009`）。
 */
export const route = {
  login: () => '/login',
  signUp: () => '/signup',
  account: () => '/account',

  groups: () => '/',
  newGroup: () => '/groups/new',

  /**
   * グループのトップ（記録一覧）。
   *
   * **操作の結果を伝える印を、行き先そのものに載せる**（`docs/adr/0009-web-ui.md`「トースト」）。
   * 記録の登録・編集・削除はここへ送り出すため、伝えごとは遷移をまたぐ。**サーバー側で持ち回らず**
   * （`docs/adr/0003`）、渡した相手のブラウザだけが持つ場所に置く。
   */
  group: (groupId: string, notice?: NoticeTag) =>
    notice === undefined
      ? `/groups/${groupId}`
      : `/groups/${groupId}?${NOTICE_PARAM}=${encodeURIComponent(notice)}`,
  balances: (groupId: string) => `/groups/${groupId}/balances`,
  settlement: (groupId: string) => `/groups/${groupId}/settlement`,
  settings: (groupId: string) => `/groups/${groupId}/settings`,

  newRecord: (groupId: string) => `/groups/${groupId}/records/new`,
  record: (groupId: string, recordId: string) => `/groups/${groupId}/records/${recordId}`,

  /**
   * 参加コードを埋め込んだ共有リンク（`docs/domain/group.md`「Group の属性」）。
   *
   * **形の正は `src/adapter/shared/invite.ts`。** 参加の画面を持つのは Web だが、
   * リンクを人に渡すのは Discord からも起きるため、path はクライアントをまたいで 1 か所にある。
   */
  invite: (inviteCode: string) => invitePath(inviteCode),
} as const

import { invitePath } from '../../shared/invite'

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

  group: (groupId: string) => `/groups/${groupId}`,
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

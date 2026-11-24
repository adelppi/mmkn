import { NOTICE_PARAM, type NoticeTag } from './notice'

/** 開いていた招待の参加コードを運ぶ場所（問い合わせ文字列）。 */
export const INVITE_PARAM = 'invite'

/** ログインできなかった理由を運ぶ場所（問い合わせ文字列）。**印だけで、文言は載せない。** */
export const LOGIN_FAILURE_PARAM = 'failure'

/** ログインできなかった理由。文言は `message.ts` が持つ。 */
export type LoginFailure = 'loginDenied' | 'loginFailed'

const withQuery = (path: string, query: Readonly<Record<string, string | undefined>>): string => {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) params.set(name, value)
  }

  return params.size === 0 ? path : `${path}?${params}`
}

/** **参加コードは 1 区間に収める。** 区切りを含む値が来ても、別の場所を指さない。 */
const invitePath = (inviteCode: string): string => `/j/${encodeURIComponent(inviteCode)}`

/** 画面の場所（`docs/adr/0009-web-ui.md`）。**ビューモデルに載せるリンクはここで組み立てる。** */
export const route = {
  login: (options: { readonly inviteCode?: string; readonly failure?: LoginFailure } = {}) =>
    withQuery('/login', {
      [INVITE_PARAM]: options.inviteCode,
      [LOGIN_FAILURE_PARAM]: options.failure,
    }),
  signUp: (inviteCode?: string) => withQuery('/signup', { [INVITE_PARAM]: inviteCode }),
  account: () => '/account',

  groups: () => '/',

  /**
   * ログインした、またはアカウントを作成したあとに着く場所（`docs/domain/group.md`「ログインする」）。
   *
   * **受け取るのは参加コードで、行き先ではない。** 行き先を受け取らないため、外へは送り出せない
   * （`docs/adr/0012-login.md`「招待への戻り方」）。
   */
  entrance: (inviteCode?: string) => (inviteCode === undefined ? '/' : invitePath(inviteCode)),
  newGroup: () => '/groups/new',

  /** グループのトップ（記録一覧）。操作の結果を伝える印を載せられる（`docs/adr/0009-web-ui.md`「トースト」）。 */
  group: (groupId: string, notice?: NoticeTag) =>
    notice === undefined
      ? `/groups/${groupId}`
      : `/groups/${groupId}?${NOTICE_PARAM}=${encodeURIComponent(notice)}`,
  balances: (groupId: string) => `/groups/${groupId}/balances`,
  settlement: (groupId: string) => `/groups/${groupId}/settlement`,
  settings: (groupId: string) => `/groups/${groupId}/settings`,

  newRecord: (groupId: string) => `/groups/${groupId}/records/new`,
  record: (groupId: string, recordId: string) => `/groups/${groupId}/records/${recordId}`,

  /** 参加コードを埋め込んだ共有リンク。`origin` は入口が渡す（アダプタは実行環境を知らない）。 */
  inviteUrl: (origin: string, inviteCode: string) => `${origin}${invitePath(inviteCode)}`,
} as const

import type { UserId } from '../../domain/id'

/**
 * 連携する外部アカウントと User の対応を扱うポート
 * （`docs/adr/0008-layer-internals.md` のツリー：(サービス種別, 外部 ID) → User）。
 *
 * ここで扱うのは **連携する**外部アカウントだけで、**ログインに使う**外部アカウントは含まない
 * （`docs/domain/group.md`「User と外部アカウント」。役割が違い、解除できるかどうかも違う）。
 * ログインに使う側は `User` のログイン識別子であり、`UserRepository` が扱う。
 *
 * **実装は認証基盤の側を読む形になるため `infra/auth` に置く**（`docs/adr/0007`）。
 * mmkn 側にこの対応のテーブルを持たない。ここでポートを挟むのは、認証基盤のスキーマへの依存を
 * その実装の中だけに閉じるためである。
 */

/**
 * 外部サービス上のアカウント。
 *
 * どのサービスがあるかはドメインの関心ではないため、種別の値を列挙しない
 * （`src/domain/group/place-mapping.ts` の `Place` と同じ形）。
 */
export type ExternalAccount = {
  readonly service: string
  readonly id: string
}

/**
 * 連携の結果（`docs/domain/group.md`「外部アカウントを連携する」）。
 *
 * - `linkedToAnotherUser` … その外部アカウントが既に別の User に連携されている。
 *   **連携は失敗し、連携先は移らない。** 他の User の連携を奪う経路を持たない
 * - `serviceAlreadyLinked` … その User が既に同じサービスのアカウントを連携している（1 サービスにつき 1 つ）
 */
export type LinkExternalAccountOutcome =
  | { readonly kind: 'linked' }
  | { readonly kind: 'linkedToAnotherUser' }
  | { readonly kind: 'serviceAlreadyLinked' }

export type ExternalAccountRepository = {
  /**
   * 外部アカウントから User を引く。連携されていなければ `undefined`。
   *
   * **外部 ID からアプリの ID への変換は入口だけで行う**（`docs/adr/0004`）。
   * 内側へ流すのは `UserId` だけで、外部アカウントそのものは流さない。
   */
  findUserId(account: ExternalAccount): Promise<UserId | undefined>

  /** その User が連携している外部アカウントの一覧。 */
  listByUser(userId: UserId): Promise<readonly ExternalAccount[]>

  link(userId: UserId, account: ExternalAccount): Promise<LinkExternalAccountOutcome>

  /** そのサービスの連携を解除する。連携が無ければ何も起きない。 */
  unlink(userId: UserId, service: string): Promise<void>
}

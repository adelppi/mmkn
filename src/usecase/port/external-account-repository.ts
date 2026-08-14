import type { ExternalAccount } from '../../domain/group/login-method'
import type { UserId } from '../../domain/id'

/**
 * ログイン手段（外部アカウント）と User の対応を扱うポート
 * （`docs/adr/0008-layer-internals.md` のツリー：(サービス種別, 外部 ID) → User）。
 *
 * **実装は認証基盤の側を読む形になるため `infra/auth` に置く**（`docs/adr/0012-login.md`）。
 * mmkn 側にこの対応のテーブルを持たない。ここでポートを挟むのは、認証基盤のスキーマへの依存を
 * その実装の中だけに閉じるためである。
 *
 * ログイン手段そのものの規則（1 つ以上・1 サービスにつき 1 つ・最後の 1 つは削除できない）は
 * ドメイン層（`src/domain/group/login-method.ts`）が持つ。**ここが担うのは、その規則を
 * 同時実行のもとでも成立させることだけ**（`docs/adr/0005-data-access-and-authorization.md`）。
 */

export type { ExternalAccount }

/**
 * 追加の結果（`docs/domain/group.md`「ログイン手段を追加する」）。
 *
 * - `usedByAnotherUser` … その外部アカウントが既に**別の** User のログイン手段である。
 *   **追加は失敗し、そちらのログイン手段のままになる。** 他の User の入口を奪う経路を持たない
 * - `serviceAlreadyUsed` … その User が既に同じサービスのアカウントを持っている（1 サービスにつき 1 つ）
 */
export type AddLoginMethodOutcome =
  | { readonly kind: 'added' }
  | { readonly kind: 'usedByAnotherUser' }
  | { readonly kind: 'serviceAlreadyUsed' }

export type ExternalAccountRepository = {
  /**
   * 外部アカウントから User を引く。どの User のログイン手段でもなければ `undefined`。
   *
   * **外部 ID からアプリの ID への変換は入口だけで行う**（`docs/adr/0004`）。
   * 内側へ流すのは `UserId` だけで、外部アカウントそのものは流さない。
   */
  findUserId(account: ExternalAccount): Promise<UserId | undefined>

  /** その User のログイン手段の一覧。**1 つ以上ある。** */
  listByUser(userId: UserId): Promise<readonly ExternalAccount[]>

  add(userId: UserId, account: ExternalAccount): Promise<AddLoginMethodOutcome>

  /**
   * ログイン手段を外す。**無ければ何も起きない。**
   *
   * **「最後の 1 つは削除できない」の判定はここではない。** それは 1 人の User の一覧だけを見て
   * 決まる判断であり、ドメイン層が持つ（`src/domain/group/login-method.ts`）。
   */
  remove(userId: UserId, account: ExternalAccount): Promise<void>
}

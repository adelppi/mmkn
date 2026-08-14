import { err, ok, type Result } from '../result'

/**
 * ログイン手段（`docs/domain/group.md`「User と外部アカウント」）。
 *
 * **外部サービスのアカウントは、ログイン手段としてだけ現れる。** User はこれを 1 つ以上持ち、
 * 後から追加・削除できる。**どのログイン手段で入っても行き着く先は同じ User** であり、
 * ログイン識別子（`user.ts`）はそちらを指す。増やしても変わらない。
 *
 * どのサービスをログイン手段にできるかはドメインの関心ではないため、種別の値を列挙しない
 * （`place-mapping.ts` の `Place` と同じ形）。**正は `docs/adr/0012-login.md`。**
 */
export type ExternalAccount = {
  readonly service: string
  readonly id: string
}

export const sameExternalAccount = (a: ExternalAccount, b: ExternalAccount): boolean =>
  a.service === b.service && a.id === b.id

/**
 * 追加が通らない理由。
 *
 * **「その外部アカウントが既に別の User のもの」はここに無い。** 1 人の User だけを見ても
 * 判定できず、同時実行でしか壊れないため、成立させる手段の側が担う
 * （`docs/adr/0005-data-access-and-authorization.md`「一意性・参照の整合」）。
 */
export type AddLoginMethodFailure = { readonly kind: 'serviceAlreadyUsed' }

/** 削除が通らない理由。 */
export type RemoveLoginMethodFailure =
  | { readonly kind: 'notALoginMethod' }
  | { readonly kind: 'lastLoginMethod' }

/**
 * そのアカウントを**追加してよいか**を判定する。渡すのは**追加する前の一覧**。
 *
 * 既に同じアカウントがあるなら、増えるものは無い。**繰り返しても結果が変わらない**
 * （`docs/domain/group.md`「グループに参加する」が二重の参加に対して採っているのと同じ形）。
 */
const requireAddable = (
  methods: readonly ExternalAccount[],
  account: ExternalAccount,
): Result<void, AddLoginMethodFailure> => {
  if (methods.some((method) => sameExternalAccount(method, account))) return ok(undefined)

  // **1 サービスにつき 1 つ。** 付け替えは「削除してから追加し直す」で行う。
  if (methods.some((method) => method.service === account.service)) {
    return err({ kind: 'serviceAlreadyUsed' })
  }

  return ok(undefined)
}

/**
 * そのサービスのログイン手段を**削除してよいか**を判定し、削除する対象を返す。
 *
 * **最後の 1 つは削除できない**（`docs/domain/group.md`「ログイン手段を削除する」）。
 * すべて無くなると、その User に到達する経路が無くなる。
 */
const requireRemovable = (
  methods: readonly ExternalAccount[],
  service: string,
): Result<ExternalAccount, RemoveLoginMethodFailure> => {
  const target = methods.find((method) => method.service === service)
  if (target === undefined) return err({ kind: 'notALoginMethod' })

  if (methods.length <= 1) return err({ kind: 'lastLoginMethod' })

  return ok(target)
}

export const LoginMethod = { requireAddable, requireRemovable }

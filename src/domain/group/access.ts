import type { UserId } from '../id'
import { err, ok, type Result } from '../result'
import { Member } from './member'

/**
 * 認可の判定。
 *
 * 前提条件を満たさなかった理由の 3 区別（未ログイン / 存在しない / Member でない）は
 * `docs/domain/group.md`「前提条件を満たさなかったとき」が正で、**すべての操作に共通して効く**。
 * この判定をドメイン層に置くことは `docs/adr/0005-data-access-and-authorization.md` の決定。
 */

/** 対象は存在するが、操作する User がその Group の Member でない。 */
export type NotMember = { kind: 'notMember' }

/** 対象が手元にあるときに起こり得る理由。 */
export type MemberAccessDenied = { kind: 'notAuthenticated' } | NotMember

/** 対象を解決するところから確かめるときに起こり得る理由。「存在しない」を加えた 3 区別。 */
export type GroupAccessDenied = MemberAccessDenied | { kind: 'notFound' }

/**
 * Group を丸ごとではなく Member の一覧だけを受けるのは、`group.ts` との相互参照を作らないため。
 * 判定に要るのは Member の一覧だけであり、Group を受けるのと同じ呼び方ができる。
 */
type HasMembers = { readonly members: readonly Member[] }

/**
 * 操作する User が、その Group の Member であることを確かめ、その Member を返す。
 *
 * 対象の Group が手元にある操作（設定の変更・場の対応づけなど）で使う。
 */
export const requireMember = (
  group: HasMembers,
  actor: UserId | undefined,
): Result<Member, MemberAccessDenied> => {
  if (actor === undefined) return err({ kind: 'notAuthenticated' })

  const member = Member.byUser(group.members, actor)
  if (member === undefined) return err({ kind: 'notMember' })

  return ok(member)
}

/**
 * 対象の Group が見つからなかった場合を含めて確かめる。**「存在しない」と「Member でない」を区別する。**
 *
 * 未ログインを先に見るのは、対象の有無に依らず決まる理由だからである。
 */
export const requireGroupMember = (
  group: HasMembers | undefined,
  actor: UserId | undefined,
): Result<Member, GroupAccessDenied> => {
  if (actor === undefined) return err({ kind: 'notAuthenticated' })
  if (group === undefined) return err({ kind: 'notFound' })

  return requireMember(group, actor)
}

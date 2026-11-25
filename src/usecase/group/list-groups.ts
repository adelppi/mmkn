import type { Group } from '../../domain/group/group'
import { Member } from '../../domain/group/member'
import { idEquals, type GroupId, type UserId } from '../../domain/id'
import type { Currency } from '../../domain/money/currency'
import { err, ok } from '../../domain/result'
import { balancesOf } from '../../domain/settlement/balance'
import type { GroupRepository } from '../port/group-repository'
import type { PaymentRepository } from '../port/payment-repository'
import type { TransferRepository } from '../port/transfer-repository'
import type { UserRepository } from '../port/user-repository'
import type { UseCase, Versioned } from '../usecase'

/** 自分が Member であるグループを一覧する。一緒に返すのは**操作する User 自身の収支だけ**である。 */

export type ListGroupsInput = {
  readonly actor: UserId | undefined
}

/** ある通貨についての、操作する User の過不足。正なら受け取る側、負なら支払う側。 */
export type ViewerBalance = {
  readonly currency: Currency
  readonly amount: number
}

export type GroupSummary = {
  readonly group: Group
  /** 操作する User の収支。**過不足が 0 の通貨は含まない。** */
  readonly balances: readonly ViewerBalance[]
}

export type ListGroupsOutput = {
  /** **並びは名前の昇順。** Group の一覧に順序を定めた規則は無いため、揺れない並びを選ぶ。 */
  readonly groups: readonly GroupSummary[]
}

export type ListGroupsError = { readonly kind: 'notAuthenticated' }

export const listGroups =
  (deps: {
    groups: GroupRepository
    users: UserRepository
    payments: PaymentRepository
    transfers: TransferRepository
  }): UseCase<ListGroupsInput, ListGroupsOutput, ListGroupsError> =>
  async (input) => {
    const actor = input.actor
    if (actor === undefined) return err({ kind: 'notAuthenticated' })

    const user = await deps.users.findById(actor)
    if (user === undefined) return err({ kind: 'notAuthenticated' })

    const groups = await deps.groups.listByUser(actor)

    // `listByUser` が返した時点でその User は Member である。
    // それでも仮定せず、Member でないグループの記録は読まない（`docs/domain/group.md`）。
    const viewed = groups.map((group) => ({ group, viewer: Member.byUser(group.members, actor) }))
    const readable = viewed.flatMap(({ group, viewer }) => (viewer === undefined ? [] : [group.id]))

    // **グループごとに読まない。** 読むと、グループの数だけ問い合わせと接続が増える。
    const [payments, transfers] = await Promise.all([
      deps.payments.listByGroups(readable),
      deps.transfers.listByGroups(readable),
    ])

    const summaries = viewed.map(({ group, viewer }): GroupSummary => {
      if (viewer === undefined) return { group, balances: [] }

      const balances = balancesOf({
        payments: recordsOf(group, payments),
        transfers: recordsOf(group, transfers),
      }).flatMap(({ currency, balances }) => {
        const mine = balances.find((balance) => idEquals(balance.member, viewer.id))
        if (mine === undefined || mine.amount === 0) return []
        return [{ currency, amount: mine.amount }]
      })

      return { group, balances }
    })

    return ok({
      groups: summaries.sort((a, b) => compareByName(a.group, b.group)),
    })
  }

/** まとめて読んだ記録から、そのグループのものだけを取り出す。 */
const recordsOf = <T extends { readonly groupId: GroupId }>(
  group: Group,
  records: readonly Versioned<T>[],
): readonly T[] =>
  records.flatMap(({ record }) => (idEquals(record.groupId, group.id) ? [record] : []))

/** 名前が同じグループがあり得る（`docs/domain/group.md` は一意性を要求していない）ため、識別子で決着させる。 */
const compareByName = (a: Group, b: Group): number => {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

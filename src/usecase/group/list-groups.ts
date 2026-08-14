import type { Group } from '../../domain/group/group'
import { Member } from '../../domain/group/member'
import { idEquals, type UserId } from '../../domain/id'
import type { Currency } from '../../domain/money/currency'
import { err, ok } from '../../domain/result'
import { balancesOf } from '../../domain/settlement/balance'
import type { GroupRepository } from '../port/group-repository'
import type { PaymentRepository } from '../port/payment-repository'
import type { TransferRepository } from '../port/transfer-repository'
import type { UserRepository } from '../port/user-repository'
import type { UseCase } from '../usecase'

/**
 * 自分が Member であるグループを一覧する（`docs/domain/group.md`「Member の属性」）。
 *
 * **読み取りもユースケースを通す**（`docs/adr/0009-web-ui.md`）。
 *
 * 一緒に返すのは**操作する User 自身の収支だけ**である。他の Member の収支は
 * グループの中で見るもの（`docs/domain/settlement.md`）で、一覧に並べる必要がない。
 * **収支は保存せず、そのつど記録から導出する。**
 */

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
  /**
   * 操作する User の収支。**過不足が 0 の通貨は含まない。**
   *
   * 収支が 0 の通貨まで並べると、清算の要らない通貨が一覧を埋める。0 を落としても
   * `docs/domain/settlement.md` の収支そのものは変わらない（導出結果の見せ方の話）。
   */
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

    const summaries = await Promise.all(
      groups.map(async (group): Promise<GroupSummary> => {
        const viewer = Member.byUser(group.members, actor)
        // `listByUser` が返した時点でその User は Member である。
        // それでも仮定せず、収支の無い形で返す（`docs/domain/group.md`）。
        if (viewer === undefined) return { group, balances: [] }

        const [payments, transfers] = await Promise.all([
          deps.payments.listByGroup(group.id),
          deps.transfers.listByGroup(group.id),
        ])

        const balances = balancesOf({
          payments: payments.map((it) => it.record),
          transfers: transfers.map((it) => it.record),
        }).flatMap(({ currency, balances }) => {
          const mine = balances.find((balance) => idEquals(balance.member, viewer.id))
          if (mine === undefined || mine.amount === 0) return []
          return [{ currency, amount: mine.amount }]
        })

        return { group, balances }
      }),
    )

    return ok({
      groups: [...summaries].sort((a, b) => compareByName(a.group, b.group)),
    })
  }

/** 名前が同じグループがあり得る（`docs/domain/group.md` は一意性を要求していない）ため、識別子で決着させる。 */
const compareByName = (a: Group, b: Group): number => {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

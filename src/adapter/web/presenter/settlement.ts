import type { Group } from '../../../domain/group/group'
import { Member } from '../../../domain/group/member'
import type { MemberId } from '../../../domain/id'
import type { Result } from '../../../domain/result'
import type { Transfer } from '../../../domain/record/transfer'
import type { RegisterSettlementTransferError } from '../../../usecase/settlement/register-settlement-transfer'
import type {
  ViewSettlementError,
  ViewSettlementOutput,
} from '../../../usecase/settlement/view-settlement'
import type { Versioned } from '../../../usecase/usecase'
import { currencyNameOf, moneyText, type MoneyText } from '../../shared/money'
import { messageOf } from './message'
import { route } from './route'
import type { ViewerBalanceRowView } from './group'

/**
 * 収支と清算案の表示（`docs/features.md` #8〜#10）。
 *
 * **どちらも保存しない。** 表示のたびにユースケースが記録から導出したものを整形するだけである
 * （`docs/domain/settlement.md`）。
 */

const nameOf = (group: Group, member: MemberId): string =>
  Member.byId(group.members, member)?.displayName ?? '（不明）'

type Denied = {
  readonly kind: 'notAuthenticated' | 'notFound' | 'notMember'
  readonly message: string
  readonly groupsHref: string
}

const denied = (error: ViewSettlementError): Denied => ({
  kind: error.kind,
  message: messageOf(error),
  groupsHref: route.groups(),
})

// ── 収支（`docs/domain/settlement.md`「収支」）─────────────────────────────────

export type BalanceRowView = {
  readonly memberId: string
  readonly displayName: string
  readonly isViewer: boolean
  readonly money: MoneyText
}

export type CurrencyBalancesView = {
  readonly currency: string
  readonly currencyLabel: string
  /** **収支が 0 の Member も落とさない**（`docs/domain/settlement.md`「境界・例外ケース」）。 */
  readonly rows: readonly BalanceRowView[]
}

export type BalanceView =
  | { readonly kind: 'ok'; readonly currencies: readonly CurrencyBalancesView[] }
  | { readonly kind: 'empty'; readonly message: string }
  | Denied

export const toBalanceView = (
  viewerMemberId: string | undefined,
  result: Result<ViewSettlementOutput, ViewSettlementError>,
): BalanceView => {
  if (!result.ok) return denied(result.error)

  const { group, balances } = result.value
  if (balances.length === 0) {
    return { kind: 'empty', message: 'まだ記録がないため、収支はありません。' }
  }

  return {
    kind: 'ok',
    currencies: balances.map(({ currency, balances: rows }) => ({
      currency,
      currencyLabel: currencyNameOf(currency),
      rows: rows.map((balance) => ({
        memberId: balance.member,
        displayName: nameOf(group, balance.member),
        isViewer: viewerMemberId !== undefined && balance.member === viewerMemberId,
        money: moneyText(balance.amount, currency, { signed: true }),
      })),
    })),
  }
}

/**
 * 記録一覧の上に出す「あなたの収支」。
 *
 * **他の Member の収支は含まない。** 一覧の上に置くのは自分の過不足だけで、
 * 全員分は収支のタブで見る。
 */
export type ViewerBalanceView =
  | { readonly kind: 'ok'; readonly rows: readonly ViewerBalanceRowView[] }
  | { readonly kind: 'even'; readonly message: string }
  | Denied

export const toViewerBalanceView = (
  viewerMemberId: string | undefined,
  result: Result<ViewSettlementOutput, ViewSettlementError>,
): ViewerBalanceView => {
  if (!result.ok) return denied(result.error)

  const rows = result.value.balances.flatMap(({ currency, balances }) => {
    const mine = balances.find(
      (balance) => viewerMemberId !== undefined && balance.member === viewerMemberId,
    )
    if (mine === undefined || mine.amount === 0) return []

    return [
      {
        label: mine.amount > 0 ? '受け取る' : '支払う',
        money: moneyText(mine.amount, currency, { signed: true }),
      },
    ]
  })

  if (rows.length === 0) return { kind: 'even', message: '過不足はありません' }

  return { kind: 'ok', rows }
}

// ── 清算案（`docs/domain/settlement.md`「清算案」）─────────────────────────────

export type SettlementRowView = {
  readonly senderMemberId: string
  readonly recipientMemberId: string
  readonly senderName: string
  readonly recipientName: string
  readonly currency: string
  readonly money: MoneyText
  /** 押した人が誰でも登録できる（`docs/domain/settlement.md`「清算案の送金を記録する」）。 */
  readonly actionLabel: string
}

export type SettlementCurrencyView = {
  readonly currency: string
  readonly currencyLabel: string
  readonly countLabel: string
  readonly rows: readonly SettlementRowView[]
}

export type SettlementView =
  | {
      readonly kind: 'ok'
      readonly currencies: readonly SettlementCurrencyView[]
      readonly note: string
    }
  | { readonly kind: 'settled'; readonly message: string }
  | Denied

const SETTLEMENT_NOTE =
  '「送金した」を押すと、その時点の清算案の額で送金を記録します。金額の入力はありません。'

export const toSettlementView = (
  result: Result<ViewSettlementOutput, ViewSettlementError>,
): SettlementView => {
  if (!result.ok) return denied(result.error)

  const { group, settlements } = result.value

  const currencies = settlements.flatMap((settlement) => {
    if (settlement.transfers.length === 0) return []

    return [
      {
        currency: settlement.currency,
        currencyLabel: currencyNameOf(settlement.currency),
        countLabel: `${settlement.transfers.length} 件`,
        rows: settlement.transfers.map((transfer) => ({
          senderMemberId: transfer.sender,
          recipientMemberId: transfer.recipient,
          senderName: nameOf(group, transfer.sender),
          recipientName: nameOf(group, transfer.recipient),
          currency: settlement.currency,
          money: moneyText(transfer.amount, settlement.currency),
          actionLabel: '送金した',
        })),
      },
    ]
  })

  // 記録があっても、全員の過不足が無ければ送るお金は無い。
  if (currencies.length === 0) {
    return { kind: 'settled', message: '送る必要のあるお金はありません' }
  }

  return { kind: 'ok', currencies, note: SETTLEMENT_NOTE }
}

/**
 * 清算案からの送金記録の結果。
 *
 * **押した時点の清算案にその送金が無ければ、Transfer は登録されず、変わったことが伝わる**
 * （`docs/domain/settlement.md`）。
 */
export type SettlementTransferView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'registered'; readonly message: string }
  | { readonly kind: 'changed'; readonly message: string; readonly reloadHref: string }
  | { readonly kind: 'failed'; readonly message: string }

export const initialSettlementTransferView = (): SettlementTransferView => ({ kind: 'idle' })

export const toSettlementTransferView = (
  groupId: string,
  result: Result<Versioned<Transfer>, RegisterSettlementTransferError>,
): SettlementTransferView => {
  if (result.ok) {
    const { money } = result.value.record

    return {
      kind: 'registered',
      // **金額は登録の時点で導出し直したもの**であり、押した画面に出ていた額とは限らない
      // （`docs/domain/settlement.md`）。実際に記録された額をそのまま伝える。
      message: `${moneyText(money.amount, money.currency).text} の送金を記録しました。`,
    }
  }

  if (result.error.kind === 'settlementChanged') {
    return {
      kind: 'changed',
      message: messageOf(result.error),
      reloadHref: route.settlement(groupId),
    }
  }

  return { kind: 'failed', message: messageOf(result.error) }
}

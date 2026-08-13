import type { Group } from '../../domain/group/group'
import type { Member } from '../../domain/group/member'
import type { Place, PlaceMapping } from '../../domain/group/place-mapping'
import type { User } from '../../domain/group/user'
import {
  idEquals,
  toGroupId,
  toMemberId,
  toPaymentId,
  toTransferId,
  toUserId,
  type GroupId,
  type PaymentId,
  type TransferId,
  type UserId,
} from '../../domain/id'
import type { Payment } from '../../domain/record/payment'
import type { Transfer } from '../../domain/record/transfer'
import type { Version, Versioned, VersionedDelete, VersionedWrite } from '../usecase'
import type { Clock } from './clock'
import type { CreateGroupOutcome, GroupRepository } from './group-repository'
import type { IdGenerator } from './id-generator'
import type { InviteCodeGenerator } from './invite-code-generator'
import type { PaymentRepository } from './payment-repository'
import type { PlaceMappingRepository } from './place-mapping-repository'
import type { TransferRepository } from './transfer-repository'
import type { CreateUserOutcome, UserRepository } from './user-repository'

/**
 * ポートの偽実装。**テストからだけ使う。**
 *
 * `docs/adr/0004-layers-and-dependencies.md` は「ドメイン・ユースケースの単体テストは、
 * 実 DB・実 HTTP を使わずポートの偽実装で回す」と定めており、`docs/adr/0008` は
 * 「ユースケースが依存を引数で受けるため、テストで偽実装に差し替えるのに仕掛けが要らない」を
 * 利点に挙げている。**これがその偽実装で、モックの仕組みを何も必要としない。**
 *
 * **実装は本物と同じ約束を守る。** 特に次の 2 つは、守らないとテストが本物と違う結論を出す。
 *
 * - `addMembers` は**追加された Member だけを書き込む**（一覧を置き換えない）
 * - 更新・削除は**操作者が見ていた版と一致するときだけ通る**
 *
 * ここで作る ID は**連番であり、本物の生成器の代わりにはならない**
 * （本物は乱数由来である必要がある。`docs/adr/0008`「識別子の生成」）。テストの中で
 * 並びと同一性が読めることを優先している。
 */

const INITIAL_VERSION: Version = 1

/** 常に同じ時刻を返す時計。 */
export const fakeClock = (at: Date): Clock => ({ now: () => at })

/** 呼ばれるたびに `<prefix>-<連番>` を返す。**連番であるため本番では使えない。** */
export const fakeIdGenerator = (prefix = 'id'): IdGenerator => {
  let counter = 0
  const next = () => `${prefix}-${String((counter += 1)).padStart(4, '0')}`

  return {
    userId: () => toUserId(next()),
    groupId: () => toGroupId(next()),
    memberId: () => toMemberId(next()),
    paymentId: () => toPaymentId(next()),
    transferId: () => toTransferId(next()),
  }
}

/**
 * 決められた順に参加コードを返す。使い切ったあとは末尾の値に連番を足したものを返す。
 *
 * 衝突したときに生成し直す振る舞い（`docs/adr/0002-invite-code.md`）を試すために、
 * 最初のいくつかを指定できるようにしてある。
 */
export const fakeInviteCodeGenerator = (...codes: readonly string[]): InviteCodeGenerator => {
  let counter = 0

  return {
    next: () => {
      const code = codes[counter]
      counter += 1
      return code ?? `invite-${String(counter).padStart(4, '0')}`
    },
  }
}

export type FakeUserRepository = UserRepository & {
  readonly stored: () => readonly User[]
}

export const fakeUserRepository = (initial: readonly User[] = []): FakeUserRepository => {
  const users = new Map<string, User>(initial.map((user) => [user.id, user]))

  return {
    findById: async (id: UserId) => users.get(id),

    findByLoginIdentifier: async (loginIdentifier: string) =>
      [...users.values()].find((user) => user.loginIdentifier === loginIdentifier),

    create: async (user: User): Promise<CreateUserOutcome> => {
      const taken = [...users.values()].some(
        (stored) => stored.loginIdentifier === user.loginIdentifier,
      )
      if (taken) return { kind: 'loginIdentifierTaken' }

      users.set(user.id, user)
      return { kind: 'created' }
    },

    stored: () => [...users.values()],
  }
}

type StoredGroup = {
  id: GroupId
  name: string
  defaultCurrency: Group['defaultCurrency']
  inviteCode: string
  members: Member[]
}

export type FakeGroupRepository = GroupRepository & {
  readonly stored: () => readonly Group[]
}

export const fakeGroupRepository = (initial: readonly Group[] = []): FakeGroupRepository => {
  const groups = new Map<string, StoredGroup>()

  const put = (group: Group) => {
    groups.set(group.id, {
      id: group.id,
      name: group.name,
      defaultCurrency: group.defaultCurrency,
      inviteCode: group.inviteCode,
      members: [...group.members],
    })
  }

  for (const group of initial) put(group)

  const read = (stored: StoredGroup | undefined): Group | undefined =>
    stored === undefined
      ? undefined
      : {
          id: stored.id,
          name: stored.name,
          defaultCurrency: stored.defaultCurrency,
          inviteCode: stored.inviteCode,
          members: [...stored.members],
        }

  return {
    findById: async (id: GroupId) => read(groups.get(id)),

    findByInviteCode: async (inviteCode: string) =>
      read([...groups.values()].find((group) => group.inviteCode === inviteCode)),

    create: async (group: Group): Promise<CreateGroupOutcome> => {
      const taken = [...groups.values()].some((stored) => stored.inviteCode === group.inviteCode)
      if (taken) return { kind: 'inviteCodeTaken' }

      put(group)
      return { kind: 'created' }
    },

    saveSettings: async (group: Group) => {
      const stored = groups.get(group.id)
      if (stored === undefined) return

      stored.name = group.name
      stored.defaultCurrency = group.defaultCurrency
    },

    addMembers: async (group: Group) => {
      const stored = groups.get(group.id)
      if (stored === undefined) return

      // **追加された Member だけを書き込む。** 一覧の置き換えをしないため、
      // 既にいる Member は（同時に参加した別の人の Member も含めて）そのまま残る。
      for (const member of group.members) {
        const exists = stored.members.some((it) => idEquals(it.userId, member.userId))
        if (!exists) stored.members.push(member)
      }
    },

    saveDisplayName: async (member: Member) => {
      const stored = groups.get(member.groupId)
      if (stored === undefined) return

      stored.members = stored.members.map((it) =>
        idEquals(it.id, member.id) ? { ...it, displayName: member.displayName } : it,
      )
    },

    stored: () => [...groups.values()].flatMap((group) => read(group) ?? []),
  }
}

export type FakePaymentRepository = PaymentRepository & {
  readonly stored: () => readonly Versioned<Payment>[]
}

export const fakePaymentRepository = (
  initial: readonly Versioned<Payment>[] = [],
): FakePaymentRepository => {
  const payments = new Map<string, Versioned<Payment>>(
    initial.map((payment) => [payment.record.id, payment]),
  )

  return {
    find: async (id: PaymentId) => payments.get(id),

    listByGroup: async (groupId: GroupId) =>
      [...payments.values()].filter((payment) => idEquals(payment.record.groupId, groupId)),

    create: async (payment: Payment) => {
      payments.set(payment.id, { record: payment, version: INITIAL_VERSION })
      return INITIAL_VERSION
    },

    update: async (payment: Payment, seen: Version): Promise<VersionedWrite> => {
      const stored = payments.get(payment.id)
      if (stored === undefined || stored.version !== seen) return { kind: 'stale' }

      const version = stored.version + 1
      payments.set(payment.id, { record: payment, version })
      return { kind: 'written', version }
    },

    remove: async (id: PaymentId, seen: Version): Promise<VersionedDelete> => {
      const stored = payments.get(id)
      if (stored === undefined || stored.version !== seen) return { kind: 'stale' }

      payments.delete(id)
      return { kind: 'deleted' }
    },

    stored: () => [...payments.values()],
  }
}

export type FakeTransferRepository = TransferRepository & {
  readonly stored: () => readonly Versioned<Transfer>[]
}

export const fakeTransferRepository = (
  initial: readonly Versioned<Transfer>[] = [],
): FakeTransferRepository => {
  const transfers = new Map<string, Versioned<Transfer>>(
    initial.map((transfer) => [transfer.record.id, transfer]),
  )

  return {
    find: async (id: TransferId) => transfers.get(id),

    listByGroup: async (groupId: GroupId) =>
      [...transfers.values()].filter((transfer) => idEquals(transfer.record.groupId, groupId)),

    create: async (transfer: Transfer) => {
      transfers.set(transfer.id, { record: transfer, version: INITIAL_VERSION })
      return INITIAL_VERSION
    },

    update: async (transfer: Transfer, seen: Version): Promise<VersionedWrite> => {
      const stored = transfers.get(transfer.id)
      if (stored === undefined || stored.version !== seen) return { kind: 'stale' }

      const version = stored.version + 1
      transfers.set(transfer.id, { record: transfer, version })
      return { kind: 'written', version }
    },

    remove: async (id: TransferId, seen: Version): Promise<VersionedDelete> => {
      const stored = transfers.get(id)
      if (stored === undefined || stored.version !== seen) return { kind: 'stale' }

      transfers.delete(id)
      return { kind: 'deleted' }
    },

    stored: () => [...transfers.values()],
  }
}

export type FakePlaceMappingRepository = PlaceMappingRepository & {
  readonly stored: () => readonly PlaceMapping[]
}

export const fakePlaceMappingRepository = (
  initial: readonly PlaceMapping[] = [],
): FakePlaceMappingRepository => {
  const key = (place: Place) => `${place.service} ${place.id}`
  const mappings = new Map<string, PlaceMapping>(
    initial.map((mapping) => [key(mapping.place), mapping]),
  )

  return {
    find: async (place: Place) => mappings.get(key(place)),

    // 場を鍵とするため、既に別の Group が対応していれば置き換わる（後勝ち）。
    save: async (mapping: PlaceMapping) => {
      mappings.set(key(mapping.place), mapping)
    },

    remove: async (place: Place) => {
      mappings.delete(key(place))
    },

    stored: () => [...mappings.values()],
  }
}

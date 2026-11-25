import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { GroupId, PaymentId } from '../../../domain/id'
import type { Payment } from '../../../domain/record/payment'
import type { PaymentRepository } from '../../../usecase/port/payment-repository'
import type { Version, Versioned, VersionedDelete, VersionedWrite } from '../../../usecase/usecase'
import type { Database } from '../client'
import { fromPayment, fromPaymentBearers, toPayments } from '../mapper/payment'
import { paymentBearers, payments } from '../schema'

/** `PaymentRepository` の実装（`docs/adr/0005-data-access-and-authorization.md`）。 */

/** 最初の版。 */
const INITIAL_VERSION: Version = 1

/**
 * Payment と、その負担者を **1 本の問い合わせ**で読む。負担者を別に引くと往復が 2 段になる。
 *
 * **外部結合にするのは、負担者の行が無い Payment を落とさないためである。**
 * 並び順はここでは決めない（`docs/domain/record.md`「記録の並び」がドメインの規則として持つ）。
 */
const load = async (db: Database, where: SQL): Promise<readonly Versioned<Payment>[]> => {
  const rows = await db
    .select({ payment: payments, bearer: paymentBearers })
    .from(payments)
    .leftJoin(paymentBearers, eq(paymentBearers.paymentId, payments.id))
    .where(where)

  return toPayments(rows).map(({ payment, version }) => ({ record: payment, version }))
}

export const drizzlePaymentRepository = (db: Database): PaymentRepository => ({
  async find(id: PaymentId) {
    const [found] = await load(db, eq(payments.id, id))
    return found
  },

  async listByGroup(groupId: GroupId) {
    return load(db, eq(payments.groupId, groupId))
  },

  async listByGroups(groupIds: readonly GroupId[]) {
    if (groupIds.length === 0) return []

    return load(db, inArray(payments.groupId, [...groupIds]))
  },

  async create(payment: Payment) {
    // Payment と、その負担者を 1 つのトランザクションで書き込む。
    // 途中で失敗して負担者のいない Payment が残ることはない（`docs/adr/0008`）。
    await db.transaction(async (tx) => {
      await tx.insert(payments).values(fromPayment(payment))
      await tx.insert(paymentBearers).values([...fromPaymentBearers(payment)])
    })

    return INITIAL_VERSION
  },

  async update(payment: Payment, seen: Version): Promise<VersionedWrite> {
    return db.transaction(async (tx): Promise<VersionedWrite> => {
      const written = await tx
        .update(payments)
        .set({ ...fromPayment(payment), version: sql`${payments.version} + 1` })
        .where(and(eq(payments.id, payment.id), eq(payments.version, seen)))
        .returning({ version: payments.version })

      const [row] = written
      // 操作者が見ていた版が既に変わっていた。**黙って上書きせず、失敗として返す**
      // （`docs/domain/record.md`「同じ記録に同時に手が入ったとき」）。
      if (row === undefined) return { kind: 'stale' }

      // 負担者は集合であり差分を持たないため、置き換える。Payment 集約の内側であり、
      // 同じトランザクションの中で完結する。
      await tx.delete(paymentBearers).where(eq(paymentBearers.paymentId, payment.id))
      await tx.insert(paymentBearers).values([...fromPaymentBearers(payment)])

      return { kind: 'written', version: row.version }
    })
  },

  async remove(id: PaymentId, seen: Version): Promise<VersionedDelete> {
    // 負担者は Payment 集約の内側にあるため、参照の設定で一緒に消える（`schema.ts`）。
    // **削除履歴は残さない**（`docs/domain/record.md`「削除」）。
    const removed = await db
      .delete(payments)
      .where(and(eq(payments.id, id), eq(payments.version, seen)))
      .returning({ id: payments.id })

    return removed.length === 0 ? { kind: 'stale' } : { kind: 'deleted' }
  },
})

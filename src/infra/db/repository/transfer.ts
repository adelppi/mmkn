import { and, eq, sql } from 'drizzle-orm'
import type { GroupId, TransferId } from '../../../domain/id'
import type { Transfer } from '../../../domain/record/transfer'
import type { TransferRepository } from '../../../usecase/port/transfer-repository'
import type { Version, Versioned, VersionedDelete, VersionedWrite } from '../../../usecase/usecase'
import type { Database } from '../client'
import { fromTransfer, toTransfer } from '../mapper/transfer'
import { transfers } from '../schema'

/**
 * `TransferRepository` の実装。
 *
 * 集約は Transfer 単体で、内側に持つものが無いためトランザクションは要らない。
 * 楽観ロックの扱いは `PaymentRepository` と同じ（`docs/adr/0005-data-access-and-authorization.md`）。
 */

/** 最初の版。 */
const INITIAL_VERSION: Version = 1

export const drizzleTransferRepository = (db: Database): TransferRepository => ({
  async find(id: TransferId) {
    const [row] = await db.select().from(transfers).where(eq(transfers.id, id)).limit(1)
    if (row === undefined) return undefined

    return { record: toTransfer(row), version: row.version }
  },

  async listByGroup(groupId: GroupId) {
    const rows = await db.select().from(transfers).where(eq(transfers.groupId, groupId))

    return rows.map((row): Versioned<Transfer> => ({ record: toTransfer(row), version: row.version }))
  },

  async create(transfer: Transfer) {
    await db.insert(transfers).values(fromTransfer(transfer))

    return INITIAL_VERSION
  },

  async update(transfer: Transfer, seen: Version): Promise<VersionedWrite> {
    const written = await db
      .update(transfers)
      .set({ ...fromTransfer(transfer), version: sql`${transfers.version} + 1` })
      .where(and(eq(transfers.id, transfer.id), eq(transfers.version, seen)))
      .returning({ version: transfers.version })

    const [row] = written
    // 操作者が見ていた版が既に変わっていた。**黙って上書きせず、失敗として返す。**
    if (row === undefined) return { kind: 'stale' }

    return { kind: 'written', version: row.version }
  },

  async remove(id: TransferId, seen: Version): Promise<VersionedDelete> {
    const removed = await db
      .delete(transfers)
      .where(and(eq(transfers.id, id), eq(transfers.version, seen)))
      .returning({ id: transfers.id })

    return removed.length === 0 ? { kind: 'stale' } : { kind: 'deleted' }
  },
})

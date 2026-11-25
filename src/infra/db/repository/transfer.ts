import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { GroupId, TransferId } from '../../../domain/id'
import type { Transfer } from '../../../domain/record/transfer'
import type { TransferRepository } from '../../../usecase/port/transfer-repository'
import type { Version, Versioned, VersionedDelete, VersionedWrite } from '../../../usecase/usecase'
import type { Database } from '../client'
import { fromTransfer, toTransfer } from '../mapper/transfer'
import { transfers } from '../schema'

/** `TransferRepository` の実装（`docs/adr/0005-data-access-and-authorization.md`）。 */

/** 最初の版。 */
const INITIAL_VERSION: Version = 1

const load = async (db: Database, where: SQL): Promise<readonly Versioned<Transfer>[]> => {
  const rows = await db.select().from(transfers).where(where)

  return rows.map((row) => ({ record: toTransfer(row), version: row.version }))
}

export const drizzleTransferRepository = (db: Database): TransferRepository => ({
  async find(id: TransferId) {
    const [found] = await load(db, eq(transfers.id, id))
    return found
  },

  async listByGroup(groupId: GroupId) {
    return load(db, eq(transfers.groupId, groupId))
  },

  async listByGroups(groupIds: readonly GroupId[]) {
    if (groupIds.length === 0) return []

    return load(db, inArray(transfers.groupId, [...groupIds]))
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

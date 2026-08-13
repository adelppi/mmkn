import { eq } from 'drizzle-orm'
import type { User } from '../../../domain/group/user'
import type { UserId } from '../../../domain/id'
import type { CreateUserOutcome, UserRepository } from '../../../usecase/port/user-repository'
import type { Database } from '../client'
import { fromUser, toUser } from '../mapper/user'
import { users } from '../schema'
import { isUniqueViolation, USERS_LOGIN_IDENTIFIER_UNIQUE } from './constraint'

/** `UserRepository` の実装。 */
export const drizzleUserRepository = (db: Database): UserRepository => ({
  async findById(id: UserId) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return row === undefined ? undefined : toUser(row)
  },

  async findByLoginIdentifier(loginIdentifier: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.loginIdentifier, loginIdentifier))
      .limit(1)
    return row === undefined ? undefined : toUser(row)
  },

  async create(user: User): Promise<CreateUserOutcome> {
    try {
      await db.insert(users).values(fromUser(user))
    } catch (error) {
      // **同じログイン識別子の User が 2 つできることはない**（`docs/domain/group.md`）。
      // 2 人が同時に作ろうとしても、片方だけが通る。
      if (isUniqueViolation(error, USERS_LOGIN_IDENTIFIER_UNIQUE)) {
        return { kind: 'loginIdentifierTaken' }
      }
      throw error
    }

    return { kind: 'created' }
  },
})

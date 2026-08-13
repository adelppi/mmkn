import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { User } from '../../../domain/group/user'
import { toUserId } from '../../../domain/id'
import { jiro, taro } from '../../../usecase/fixture'
import { connectForTest, truncateAll, type TestDatabase } from '../test-support'
import { drizzleUserRepository } from './user'

/**
 * User の永続化。
 *
 * ここで固定するもの：**同じログイン識別子の User を 2 つ作れないこと**
 * （`docs/adr/0010-testing.md`「実 DB を使うテスト」・`docs/domain/group.md`）。
 */

let database: TestDatabase

beforeAll(async () => {
  database = await connectForTest()
})

afterAll(async () => {
  await database.close()
})

beforeEach(async () => {
  await truncateAll(database.db)
})

const repository = () => drizzleUserRepository(database.db)

describe('User の保存と読み出し', () => {
  it('読み戻せる', async () => {
    await repository().create(taro)

    expect(await repository().findById(taro.id)).toEqual(taro)
  })

  it('ログイン識別子から読める', async () => {
    await repository().create(taro)

    expect(await repository().findByLoginIdentifier(taro.loginIdentifier)).toEqual(taro)
  })

  it('存在しない User は undefined', async () => {
    expect(await repository().findById(toUserId('いない'))).toBeUndefined()
    expect(await repository().findByLoginIdentifier('いない')).toBeUndefined()
  })

  it('同じログイン識別子の User は 2 つできない', async () => {
    await repository().create(taro)

    const sameIdentifier = User.create({
      id: toUserId('u9'),
      name: 'べつのひと',
      loginIdentifier: taro.loginIdentifier,
    })
    if (!sameIdentifier.ok) throw new Error('前提の User を作れなかった')

    const outcome = await repository().create(sameIdentifier.value)

    expect(outcome).toEqual({ kind: 'loginIdentifierTaken' })
    expect(await repository().findById(toUserId('u9'))).toBeUndefined()
  })

  it('ログイン識別子が違えば、同じ名前の User を作れる', async () => {
    await repository().create(taro)

    const outcome = await repository().create({ ...jiro, name: taro.name })

    expect(outcome).toEqual({ kind: 'created' })
  })
})

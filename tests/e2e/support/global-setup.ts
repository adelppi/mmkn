import { connectForTest, truncateAll } from '../../../src/infra/db/test-support'

/**
 * E2E の下ごしらえ。
 *
 * **コミット済みのマイグレーションを当ててから、中身を空にする**（永続化テストと同じ道具。
 * `src/infra/db/test-support.ts`）。**接続先がループバックでなければ、そこで落ちる。**
 * 本番に向けて E2E を回す事故は、この 1 か所で塞がる（`docs/adr/0011-ci-and-release.md`）。
 *
 * **前提のデータを置かない。** E2E はアカウントの作成から始まるため、空の DB から始める。
 */
export default async function globalSetup(): Promise<void> {
  const database = await connectForTest()

  try {
    await truncateAll(database.db)
  } finally {
    await database.close()
  }
}

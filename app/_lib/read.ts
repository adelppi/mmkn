import { readOnlyAuthClient, currentUserId } from '@/app/_lib/session'
import { wire } from '@/app/_lib/wire'
import { toGroupId } from '@/src/domain/id'
import type { LogContext } from '@/src/infra/log/logger'
import { cache } from 'react'

/**
 * 画面のための読み取り。**取得を束ねる合図を立てるのはここだけである**（`docs/adr/0009-web-ui.md`「束ねる位置」）。
 *
 * 束ねるのは 2 段ある。どちらも `cache()` で、**1 リクエストの中でだけ効く。**
 *
 * | 段 | 束ねるもの |
 * |---|---|
 * | ここ | 同じ画面から同じユースケースを 2 回呼んだとき（ログも 1 回で済む） |
 * | 合成ルート（`wire()` に渡す `cache`） | **別々のユースケースが同じものを読む重複** |
 */

const context = cache(
  (): LogContext => ({ correlationId: crypto.randomUUID() }),
)

/** 読み取りの文脈では cookie を書けない（`app/_lib/session.ts`）。 */
const client = cache(async () => await readOnlyAuthClient())

/**
 * **cookie を先に読む。** 読んだ時点でリクエストごとの描画になるため、ビルド時の事前描画が
 * DB への接続を作らずに済む（ビルドの環境に本番の接続文字列は無い）。
 */
const usecases = cache(async () => {
  await client()
  return wire(context(), cache)
})

/** 現在の `UserId`。ログインしていなければ `undefined`。**失敗として扱うのはユースケース。** */
export const actor = cache(async () => await currentUserId(await client()))

export const readGroups = cache(async () => (await usecases()).listGroups({ actor: await actor() }))

export const readGroup = cache(async (groupId: string) =>
  (await usecases()).viewGroup({ actor: await actor(), group: toGroupId(groupId) }),
)

export const readRecords = cache(async (groupId: string) =>
  (await usecases()).listRecords({ actor: await actor(), group: toGroupId(groupId) }),
)

/** 収支と清算案は 1 回の呼び出しで両方返る（`src/usecase/settlement/view-settlement.ts`）。 */
export const readSettlement = cache(async (groupId: string) =>
  (await usecases()).viewSettlement({ actor: await actor(), group: toGroupId(groupId) }),
)

export const readInvite = cache(async (inviteCode: string) =>
  (await usecases()).viewInvite({ actor: await actor(), inviteCode }),
)

export const readAccount = cache(async () => (await usecases()).viewAccount({ actor: await actor() }))

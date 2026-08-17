import { readOnlyAuthClient, currentUserId } from '@/app/_lib/session'
import { wire } from '@/app/_lib/wire'
import { toGroupId } from '@/src/domain/id'
import type { LogContext } from '@/src/infra/log/logger'
import { cache } from 'react'

/**
 * 画面のための読み取り（`docs/adr/0009-web-ui.md`「Container の粒度」）。
 *
 * **Container はデータ取得の単位で分かれるため、同じ取得が複数回走る。**
 * 収支と清算案はどちらも記録の全件を読み（`docs/domain/settlement.md`）、記録一覧も同じ材料を使う。
 * **その重複を束ねる合図を立てるのがここである**（`docs/adr/0009-web-ui.md`「束ねる位置」）。
 *
 * 束ねるのは 2 段ある。どちらも `cache()` で、**1 リクエストの中でだけ効く。**
 *
 * | 段 | 束ねるもの |
 * |---|---|
 * | ここ | 同じ画面から同じユースケースを 2 回呼んだとき（ログも 1 回で済む） |
 * | 合成ルート（`wire()` に渡す `cache`） | **別々のユースケースが同じものを読む重複** |
 *
 * **上段だけでは足りない。** 上端はグループを読み、記録の一覧もグループを読み、収支もグループを
 * 読む。それぞれ違うユースケースなので、ユースケースの単位で束ねる限り 3 回とも走る。
 *
 * リクエストをまたいで値を持ち越さないため、`docs/adr/0003-tech-stack.md` の
 * 「プロセス内メモリに状態を保持しない」には触れない。
 *
 * **この合図を立ててよいのは、ここが読み取りだけの経路だからである**（`docs/adr/0009`
 * 「束ねるのは読み取りだけの経路に限る」）。書き込みを伴う `app/_lib/action.ts` では立てない。
 *
 * **読み取りもユースケースを通す**（`docs/adr/0005-data-access-and-authorization.md`）。
 * ここにリポジトリを直接呼ぶ経路は無い。
 */

const context = cache(
  (): LogContext => ({ correlationId: crypto.randomUUID(), client: 'web' }),
)

/** 読み取りの文脈では cookie を書けない（`app/_lib/session.ts`）。 */
const client = cache(async () => await readOnlyAuthClient())

const usecases = cache(async () => wire(context(), await client(), cache))

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

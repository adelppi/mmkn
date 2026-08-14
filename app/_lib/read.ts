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
 * **その重複をここで束ねる。**
 *
 * 束ねているのは `cache()` であり、**1 リクエストの中でだけ効く。**
 * リクエストをまたいで値を持ち越さないため、`docs/adr/0003-tech-stack.md` の
 * 「プロセス内メモリに状態を保持しない」には触れない。
 *
 * **読み取りもユースケースを通す**（`docs/adr/0005-data-access-and-authorization.md`）。
 * ここにリポジトリを直接呼ぶ経路は無い。
 */

const context = cache(
  (): LogContext => ({ correlationId: crypto.randomUUID(), client: 'web' }),
)

/** 読み取りの文脈では cookie を書けない（`app/_lib/session.ts`）。 */
const client = cache(async () => await readOnlyAuthClient())

const usecases = cache(async () => wire(context(), await client()))

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

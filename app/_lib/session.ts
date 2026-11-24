import type { UserId } from '@/src/domain/id'
import { createAuthClient, type AuthClient, type CookieStore } from '@/src/infra/auth/client'
import { currentUserId as resolveUserId } from '@/src/infra/auth/session'
import { database } from '@/src/infra/db/client'
import { drizzleUserRepository } from '@/src/infra/db/repository/user'
import { cookies } from 'next/headers'

/**
 * 現在の `UserId` を得る（`docs/adr/0008-layer-internals.md`「セッションの読み取り」）。
 *
 * **解決そのものは `infra/auth` にあり、ここは cookie へのアクセス手段を渡すだけである。**
 */

/**
 * cookie を書けない文脈（Server Component）向け。
 *
 * **書き込みを捨ててよいのは、`proxy.ts` が先に更新して書き戻しているためである。**
 * `proxy.ts` を外すと、「しばらくすると勝手にログアウトされる」形で表に出る。
 */
const readOnlyCookies = async (): Promise<CookieStore> => {
  const store = await cookies()

  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    setAll: () => {},
  }
}

/** cookie を書ける文脈（Server Action・Route Handler）向け。 */
const writableCookies = async (): Promise<CookieStore> => {
  const store = await cookies()

  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (list) => {
      for (const { name, value, options } of list) store.set(name, value, options)
    },
  }
}

/** 読み取りだけの文脈で使う。**ログイン・ログアウトには使えない。** */
export const readOnlyAuthClient = async (): Promise<AuthClient> =>
  createAuthClient(await readOnlyCookies())

/** セッションを変える操作（ログイン・ログアウト）で使う。 */
export const authClient = async (): Promise<AuthClient> =>
  createAuthClient(await writableCookies())

/** 現在の `UserId`。ログインしていない、またはその識別子の User がまだいなければ `undefined`。 */
export const currentUserId = async (client: AuthClient): Promise<UserId | undefined> =>
  await resolveUserId(client, drizzleUserRepository(database()))

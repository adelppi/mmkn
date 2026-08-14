import { describe, expect, it } from 'vitest'
import { toUserId } from '../../domain/id'
import { jiro, taro } from '../fixture'
import {
  fakeExternalAccountRepository,
  fakeUserRepository,
  type StoredLoginMethod,
} from '../port/fake'
import { addLoginMethod } from './add-login-method'

const google = { service: 'google', id: 'google-1' }
const discord = { service: 'discord', id: 'discord-1' }

/** taro は Google で登録済み、jiro は Discord で登録済み、という前提から始める。 */
const deps = (initial: readonly StoredLoginMethod[] = [{ userId: taro.id, account: google }]) => ({
  users: fakeUserRepository([taro, jiro]),
  externalAccounts: fakeExternalAccountRepository(initial),
})

describe('ログイン手段を追加する', () => {
  it('その外部アカウントでもログインできるようになる', async () => {
    const d = deps()

    const result = await addLoginMethod(d)({ actor: taro.id, account: discord })

    expect(result).toEqual({ ok: true, value: discord })
    expect(await d.externalAccounts.findUserId(discord)).toBe(taro.id)
  })

  it('元のログイン手段は残る', async () => {
    const d = deps()

    await addLoginMethod(d)({ actor: taro.id, account: discord })

    expect(await d.externalAccounts.listByUser(taro.id)).toEqual([google, discord])
  })

  it('ログインしていなければ失敗し、ログイン手段は増えない', async () => {
    const d = deps()

    const result = await addLoginMethod(d)({ actor: undefined, account: discord })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.externalAccounts.stored()).toHaveLength(1)
  })

  it('操作する User が存在しなければ、ログインしていないものとして扱う', async () => {
    const d = deps()

    const result = await addLoginMethod(d)({ actor: toUserId('いない'), account: discord })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.externalAccounts.stored()).toHaveLength(1)
  })

  it('既に別の User のログイン手段なら失敗し、そちらのままになる', async () => {
    const d = deps([
      { userId: taro.id, account: google },
      { userId: jiro.id, account: discord },
    ])

    const result = await addLoginMethod(d)({ actor: taro.id, account: discord })

    expect(result).toEqual({ ok: false, error: { kind: 'usedByAnotherUser' } })
    expect(await d.externalAccounts.findUserId(discord)).toBe(jiro.id)
    expect(await d.externalAccounts.listByUser(taro.id)).toEqual([google])
  })

  it('同じサービスのアカウントを 2 つ持つことはできない', async () => {
    const d = deps([
      { userId: taro.id, account: google },
      { userId: taro.id, account: discord },
    ])

    const result = await addLoginMethod(d)({
      actor: taro.id,
      account: { service: 'discord', id: 'discord-2' },
    })

    expect(result).toEqual({ ok: false, error: { kind: 'serviceAlreadyUsed' } })
    // 元のログイン手段がそのまま残る。付け替えは、削除してから追加し直す。
    expect(await d.externalAccounts.listByUser(taro.id)).toEqual([google, discord])
  })

  it('同じアカウントを追加し直しても、ログイン手段は増えない', async () => {
    const d = deps()

    const result = await addLoginMethod(d)({ actor: taro.id, account: google })

    expect(result).toEqual({ ok: true, value: google })
    expect(await d.externalAccounts.listByUser(taro.id)).toEqual([google])
  })

  it('User の名前は、外部サービス側の名前で上書きされない', async () => {
    const d = deps()

    await addLoginMethod(d)({ actor: taro.id, account: discord })

    expect(d.users.stored()).toEqual([taro, jiro])
  })
})

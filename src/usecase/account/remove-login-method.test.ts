import { describe, expect, it } from 'vitest'
import { toUserId } from '../../domain/id'
import { jiro, taro } from '../fixture'
import {
  fakeExternalAccountRepository,
  fakeUserRepository,
  type StoredLoginMethod,
} from '../port/fake'
import { removeLoginMethod } from './remove-login-method'

const google = { service: 'google', id: 'google-1' }
const discord = { service: 'discord', id: 'discord-1' }

/** 既定では taro が 2 つ持っている（そうでないと、そもそも削除できない）。 */
const deps = (
  initial: readonly StoredLoginMethod[] = [
    { userId: taro.id, account: google },
    { userId: taro.id, account: discord },
  ],
) => ({
  users: fakeUserRepository([taro, jiro]),
  externalAccounts: fakeExternalAccountRepository(initial),
})

describe('ログイン手段を削除する', () => {
  it('その外部アカウントではログインできなくなる', async () => {
    const d = deps()

    const result = await removeLoginMethod(d)({ actor: taro.id, service: 'discord' })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await d.externalAccounts.findUserId(discord)).toBeUndefined()
  })

  it('他のログイン手段は残る', async () => {
    const d = deps()

    await removeLoginMethod(d)({ actor: taro.id, service: 'discord' })

    expect(await d.externalAccounts.listByUser(taro.id)).toEqual([google])
  })

  it('User は消えない', async () => {
    const d = deps()

    await removeLoginMethod(d)({ actor: taro.id, service: 'discord' })

    expect(d.users.stored()).toEqual([taro, jiro])
  })

  it('**最後の 1 つは削除できない**', async () => {
    const d = deps([{ userId: taro.id, account: google }])

    const result = await removeLoginMethod(d)({ actor: taro.id, service: 'google' })

    expect(result).toEqual({ ok: false, error: { kind: 'lastLoginMethod' } })
    expect(await d.externalAccounts.listByUser(taro.id)).toEqual([google])
  })

  it('そのサービスのログイン手段が無ければ失敗する', async () => {
    const d = deps()

    const result = await removeLoginMethod(d)({ actor: taro.id, service: 'slack' })

    expect(result).toEqual({ ok: false, error: { kind: 'notALoginMethod' } })
    expect(d.externalAccounts.stored()).toHaveLength(2)
  })

  it('他の User のログイン手段は変わらない', async () => {
    const d = deps([
      { userId: taro.id, account: google },
      { userId: jiro.id, account: discord },
    ])

    const result = await removeLoginMethod(d)({ actor: taro.id, service: 'discord' })

    expect(result).toEqual({ ok: false, error: { kind: 'notALoginMethod' } })
    expect(await d.externalAccounts.findUserId(discord)).toBe(jiro.id)
  })

  it('ログインしていなければ失敗し、ログイン手段は変わらない', async () => {
    const d = deps()

    const result = await removeLoginMethod(d)({ actor: undefined, service: 'discord' })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.externalAccounts.stored()).toHaveLength(2)
  })

  it('操作する User が存在しなければ、ログインしていないものとして扱う', async () => {
    const d = deps()

    const result = await removeLoginMethod(d)({ actor: toUserId('いない'), service: 'discord' })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.externalAccounts.stored()).toHaveLength(2)
  })

  it('削除したあと、同じサービスの別のアカウントを追加し直せる', async () => {
    const d = deps()
    await removeLoginMethod(d)({ actor: taro.id, service: 'discord' })

    const outcome = await d.externalAccounts.add(taro.id, { service: 'discord', id: 'discord-2' })

    expect(outcome).toEqual({ kind: 'added' })
  })
})

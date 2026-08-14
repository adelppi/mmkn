import { describe, expect, it } from 'vitest'
import { toUserId } from '../../domain/id'
import { jiro, taro } from '../fixture'
import { fakeExternalAccountRepository, fakeUserRepository, type StoredLink } from '../port/fake'
import { linkExternalAccount } from './link-external-account'

const discord = { service: 'discord', id: 'discord-1' }

const deps = (initial: readonly StoredLink[] = []) => ({
  users: fakeUserRepository([taro, jiro]),
  externalAccounts: fakeExternalAccountRepository(initial),
})

describe('外部アカウントを連携する', () => {
  it('User と外部アカウントの対応が記録される', async () => {
    const d = deps()

    const result = await linkExternalAccount(d)({ actor: taro.id, account: discord })

    expect(result).toEqual({ ok: true, value: discord })
    expect(await d.externalAccounts.findUserId(discord)).toBe(taro.id)
  })

  it('ログインしていなければ失敗し、連携は増えない', async () => {
    const d = deps()

    const result = await linkExternalAccount(d)({ actor: undefined, account: discord })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.externalAccounts.stored()).toHaveLength(0)
  })

  it('操作する User が存在しなければ、ログインしていないものとして扱う', async () => {
    const d = deps()

    const result = await linkExternalAccount(d)({ actor: toUserId('いない'), account: discord })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.externalAccounts.stored()).toHaveLength(0)
  })

  it('既に別の User に連携されていれば失敗し、連携先は移らない', async () => {
    const d = deps([{ userId: jiro.id, account: discord }])

    const result = await linkExternalAccount(d)({ actor: taro.id, account: discord })

    expect(result).toEqual({ ok: false, error: { kind: 'linkedToAnotherUser' } })
    expect(await d.externalAccounts.findUserId(discord)).toBe(jiro.id)
    expect(d.externalAccounts.stored()).toHaveLength(1)
  })

  it('同じサービスのアカウントを 2 つ連携することはできない', async () => {
    const d = deps([{ userId: taro.id, account: discord }])

    const result = await linkExternalAccount(d)({
      actor: taro.id,
      account: { service: 'discord', id: 'discord-2' },
    })

    expect(result).toEqual({ ok: false, error: { kind: 'serviceAlreadyLinked' } })
    // 元の連携がそのまま残る。付け替えは、解除してから連携し直す。
    expect(d.externalAccounts.stored()).toEqual([{ userId: taro.id, account: discord }])
  })

  it('同じアカウントを連携し直しても、対応は増えない', async () => {
    const d = deps([{ userId: taro.id, account: discord }])

    const result = await linkExternalAccount(d)({ actor: taro.id, account: discord })

    expect(result).toEqual({ ok: true, value: discord })
    expect(d.externalAccounts.stored()).toHaveLength(1)
  })

  it('サービスが違えば、2 つ目を連携できる', async () => {
    const d = deps([{ userId: taro.id, account: discord }])

    const result = await linkExternalAccount(d)({
      actor: taro.id,
      account: { service: 'slack', id: 'slack-1' },
    })

    expect(result.ok).toBe(true)
    expect(d.externalAccounts.stored()).toHaveLength(2)
  })

  it('User の名前は、外部サービス側の名前で上書きされない', async () => {
    const d = deps()

    await linkExternalAccount(d)({ actor: taro.id, account: discord })

    expect(d.users.stored()).toEqual([taro, jiro])
  })
})

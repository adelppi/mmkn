import { describe, expect, it } from 'vitest'
import { toUserId } from '../../domain/id'
import { jiro, taro } from '../fixture'
import { fakeExternalAccountRepository, fakeUserRepository, type StoredLink } from '../port/fake'
import { unlinkExternalAccount } from './unlink-external-account'

const discord = { service: 'discord', id: 'discord-1' }
const slack = { service: 'slack', id: 'slack-1' }

const deps = (initial: readonly StoredLink[] = []) => ({
  users: fakeUserRepository([taro, jiro]),
  externalAccounts: fakeExternalAccountRepository(initial),
})

describe('外部アカウントの連携を解除する', () => {
  it('対応が消える', async () => {
    const d = deps([{ userId: taro.id, account: discord }])

    const result = await unlinkExternalAccount(d)({ actor: taro.id, service: 'discord' })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await d.externalAccounts.findUserId(discord)).toBeUndefined()
  })

  it('User は消えない', async () => {
    const d = deps([{ userId: taro.id, account: discord }])

    await unlinkExternalAccount(d)({ actor: taro.id, service: 'discord' })

    expect(d.users.stored()).toEqual([taro, jiro])
  })

  it('他のサービスの連携は残る', async () => {
    const d = deps([
      { userId: taro.id, account: discord },
      { userId: taro.id, account: slack },
    ])

    await unlinkExternalAccount(d)({ actor: taro.id, service: 'discord' })

    expect(d.externalAccounts.stored()).toEqual([{ userId: taro.id, account: slack }])
  })

  it('他の User の連携は変わらない', async () => {
    const d = deps([{ userId: jiro.id, account: discord }])

    const result = await unlinkExternalAccount(d)({ actor: taro.id, service: 'discord' })

    expect(result).toEqual({ ok: false, error: { kind: 'notLinked' } })
    expect(await d.externalAccounts.findUserId(discord)).toBe(jiro.id)
  })

  it('そのサービスの連携が無ければ失敗する', async () => {
    const d = deps([{ userId: taro.id, account: slack }])

    const result = await unlinkExternalAccount(d)({ actor: taro.id, service: 'discord' })

    expect(result).toEqual({ ok: false, error: { kind: 'notLinked' } })
    expect(d.externalAccounts.stored()).toHaveLength(1)
  })

  it('ログインしていなければ失敗し、連携は変わらない', async () => {
    const d = deps([{ userId: taro.id, account: discord }])

    const result = await unlinkExternalAccount(d)({ actor: undefined, service: 'discord' })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.externalAccounts.stored()).toHaveLength(1)
  })

  it('操作する User が存在しなければ、ログインしていないものとして扱う', async () => {
    const d = deps([{ userId: taro.id, account: discord }])

    const result = await unlinkExternalAccount(d)({ actor: toUserId('いない'), service: 'discord' })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
    expect(d.externalAccounts.stored()).toHaveLength(1)
  })

  it('解除しても、連携し直せる', async () => {
    const d = deps([{ userId: taro.id, account: discord }])

    await unlinkExternalAccount(d)({ actor: taro.id, service: 'discord' })

    expect(await d.externalAccounts.link(taro.id, { service: 'discord', id: 'discord-2' })).toEqual({
      kind: 'linked',
    })
  })
})

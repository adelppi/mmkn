import { describe, expect, it } from 'vitest'
import { fakeExternalAccountRepository, fakeUserRepository } from '../port/fake'
import { taro } from '../fixture'
import { resolveActor } from './resolve-actor'

/**
 * 外部サービスから届いた操作の主の解決
 * （`docs/domain/group.md`「User と外部アカウント」「mmkn のアカウントを持たない人が…」）。
 */

const discord = { service: 'discord', id: '1234567890' }

const deps = (linked: boolean) => ({
  users: fakeUserRepository([taro]),
  externalAccounts: fakeExternalAccountRepository(
    linked ? [{ userId: taro.id, account: discord }] : [],
  ),
})

describe('外部サービスから届いた操作の主を解決する', () => {
  it('そのアカウントをログイン手段とする User が、その操作の主になる', async () => {
    const result = await resolveActor(deps(true))({ account: discord })

    expect(result).toEqual({ ok: true, value: { actor: taro.id } })
  })

  it('どの User のログイン手段でもなければ、アカウントを持たないとして失敗する', async () => {
    const result = await resolveActor(deps(false))({ account: discord })

    expect(result).toEqual({ ok: false, error: { kind: 'noAccount' } })
  })

  it('アカウントを持たない人の操作でも、User は作られない', async () => {
    const d = deps(false)

    await resolveActor(d)({ account: discord })

    expect(d.users.stored()).toEqual([taro])
  })

  it('同じサービスでも、別の外部 ID なら別人として扱う（解決できない）', async () => {
    const result = await resolveActor(deps(true))({ account: { service: 'discord', id: '999' } })

    expect(result).toEqual({ ok: false, error: { kind: 'noAccount' } })
  })
})

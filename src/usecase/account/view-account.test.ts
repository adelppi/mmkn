import { describe, expect, it } from 'vitest'
import { jiro, taro } from '../fixture'
import { fakeExternalAccountRepository, fakeUserRepository } from '../port/fake'
import { viewAccount } from './view-account'

const deps = () => ({
  users: fakeUserRepository([taro, jiro]),
  externalAccounts: fakeExternalAccountRepository([
    { userId: taro.id, account: { service: 'google', id: 'g-1' } },
    { userId: taro.id, account: { service: 'discord', id: 'd-1' } },
    { userId: jiro.id, account: { service: 'google', id: 'g-2' } },
  ]),
})

describe('自分のアカウントとログイン手段を見る', () => {
  it('自分の名前と、自分のログイン手段が返る', async () => {
    const result = await viewAccount(deps())({ actor: taro.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.user.name).toBe('たろう')
    expect(result.value.loginMethods.map((method) => method.service)).toEqual([
      'google',
      'discord',
    ])
  })

  it('他の User のログイン手段は返らない', async () => {
    const result = await viewAccount(deps())({ actor: taro.id })

    expect(result.ok && result.value.loginMethods.map((method) => method.id)).not.toContain('g-2')
  })

  it('ログインしていなければ失敗する', async () => {
    const result = await viewAccount(deps())({ actor: undefined })

    expect(result.ok === false && result.error.kind).toBe('notAuthenticated')
  })
})

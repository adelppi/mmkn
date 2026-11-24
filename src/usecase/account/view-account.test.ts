import { describe, expect, it } from 'vitest'
import { toUserId } from '../../domain/id'
import { jiro, taro } from '../fixture'
import { fakeUserRepository } from '../port/fake'
import { viewAccount } from './view-account'

const deps = () => ({ users: fakeUserRepository([taro, jiro]) })

describe('自分のアカウントを見る', () => {
  it('自分の User が返る', async () => {
    const result = await viewAccount(deps())({ actor: taro.id })

    expect(result).toEqual({ ok: true, value: taro })
  })

  it('ログインしていなければ失敗する', async () => {
    const result = await viewAccount(deps())({ actor: undefined })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
  })

  it('操作する User が存在しなければ、ログインしていないものとして扱う', async () => {
    const result = await viewAccount(deps())({ actor: toUserId('いない') })

    expect(result).toEqual({ ok: false, error: { kind: 'notAuthenticated' } })
  })
})

import { describe, expect, it } from 'vitest'
import { groupOf, hanako, jiro, taro } from '../fixture'
import { fakeGroupRepository, fakeUserRepository } from '../port/fake'
import { viewInvite } from './view-invite'

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2', displayName: 'じろー' },
])

const deps = () => ({
  groups: fakeGroupRepository([group]),
  users: fakeUserRepository([taro, jiro, hanako]),
})

describe('参加コードが指すグループを、参加する前に見る', () => {
  it('グループ名と Member の表示名が見える', async () => {
    const result = await viewInvite(deps())({ actor: hanako.id, inviteCode: group.inviteCode })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.group.name).toBe('沖縄旅行')
    expect(result.value.group.members.map((member) => member.displayName)).toEqual([
      'たろう',
      'じろー',
    ])
  })

  it('表示名の初期値に使えるよう、操作する User が返る', async () => {
    const result = await viewInvite(deps())({ actor: hanako.id, inviteCode: group.inviteCode })

    expect(result.ok && result.value.viewer.name).toBe('はなこ')
  })

  it('見ても Member は増えない', async () => {
    const d = deps()

    await viewInvite(d)({ actor: hanako.id, inviteCode: group.inviteCode })

    expect(d.groups.stored()[0]?.members).toHaveLength(2)
  })

  it('既に Member であることが分かる', async () => {
    const result = await viewInvite(deps())({ actor: taro.id, inviteCode: group.inviteCode })

    expect(result.ok && result.value.alreadyMember).toBe(true)
  })

  it('ログインしていなければ失敗する', async () => {
    const result = await viewInvite(deps())({ actor: undefined, inviteCode: group.inviteCode })

    expect(result.ok === false && result.error.kind).toBe('notAuthenticated')
  })

  it('対応する Group が無ければ「見つからない」', async () => {
    const result = await viewInvite(deps())({ actor: hanako.id, inviteCode: 'unknown' })

    expect(result.ok === false && result.error.kind).toBe('notFound')
  })
})

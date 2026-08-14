import { describe, expect, it } from 'vitest'
import { toGroupId } from '../../domain/id'
import { groupOf, hanako, jiro, taro } from '../fixture'
import { fakeGroupRepository } from '../port/fake'
import { viewGroup } from './view-group'

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

const deps = () => ({ groups: fakeGroupRepository([group]) })

describe('Group の内容を見る', () => {
  it('Group と、自分の Member が返る', async () => {
    const result = await viewGroup(deps())({ actor: taro.id, group: group.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.group.name).toBe('沖縄旅行')
    expect(result.value.group.members).toHaveLength(2)
    expect(result.value.viewer.userId).toBe(taro.id)
  })

  it('ログインしていなければ失敗する', async () => {
    const result = await viewGroup(deps())({ actor: undefined, group: group.id })

    expect(result.ok === false && result.error.kind).toBe('notAuthenticated')
  })

  it('存在しない Group は「見つからない」', async () => {
    const result = await viewGroup(deps())({ actor: taro.id, group: toGroupId('missing') })

    expect(result.ok === false && result.error.kind).toBe('notFound')
  })

  it('Member でなければ、参加コードを含む中身は返らない', async () => {
    const result = await viewGroup(deps())({ actor: hanako.id, group: group.id })

    expect(result.ok === false && result.error.kind).toBe('notMember')
  })
})

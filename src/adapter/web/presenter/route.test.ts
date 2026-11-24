import { describe, expect, it } from 'vitest'
import { route } from './route'

describe('ログインしたあとに着く場所', () => {
  it('招待から来ていなければグループ一覧', () => {
    expect(route.entrance()).toBe('/')
  })

  it('招待から来ていれば、その招待', () => {
    expect(route.entrance('invite-1')).toBe('/j/invite-1')
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '../../evil.example',
    '..',
    '\t//evil.example',
    'a?b#c',
  ])('参加コードの代わりに %j が届いても、mmkn の外へは送り出さない', (value) => {
    const destination = new URL(route.entrance(value), 'https://mmkn.example')

    expect(destination.origin).toBe('https://mmkn.example')
  })
})

describe('ログインへの導線', () => {
  it('何も持たなければ印は付かない', () => {
    expect(route.login()).toBe('/login')
    expect(route.signUp()).toBe('/signup')
  })

  it('招待と理由を運ぶ', () => {
    expect(route.login({ inviteCode: 'invite-1', failure: 'loginDenied' })).toBe(
      '/login?invite=invite-1&failure=loginDenied',
    )
    expect(route.signUp('invite-1')).toBe('/signup?invite=invite-1')
  })
})

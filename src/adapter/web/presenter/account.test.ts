import { describe, expect, it } from 'vitest'
import { USER_NAME_MAX_LENGTH } from '../../../domain/group/text'
import { err, ok } from '../../../domain/result'
import { taro } from '../../../usecase/fixture'
import {
  initialCreateAccountView,
  toAccountView,
  toCreateAccountView,
  toLoginView,
} from './account'

describe('ログイン画面', () => {
  it('始められるのは Discord だけ', () => {
    expect(toLoginView()).toEqual({ kind: 'ok', start: 'Discord で続ける' })
  })
})

describe('アカウント作成', () => {
  it('初期状態の名前は空。外部サービス側の名前を初期値にしない', () => {
    const view = initialCreateAccountView()

    expect(view.kind).toBe('input')
    expect(view.form.name).toBe('')
  })

  it('入力欄の上限はドメイン層の定数から来る', () => {
    expect(initialCreateAccountView().form.nameLimits).toEqual({
      maxLength: USER_NAME_MAX_LENGTH,
      required: true,
    })
  })

  it('成功したら、次に行く先を持つ', () => {
    const view = toCreateAccountView('たろう', ok(taro))

    expect(view.kind).toBe('created')
    expect(view.kind === 'created' && view.redirectTo).toBe('/')
  })

  it('名前が空なら失敗のタグと文言が付き、打った内容が戻る', () => {
    const view = toCreateAccountView('  ', err({ kind: 'nameEmpty' }))

    expect(view.kind).toBe('invalid')
    expect(view.kind === 'invalid' && view.message).toBe('名前を入力してください。')
    expect(view.form.name).toBe('  ')
  })

  it('同じ外部アカウントで 2 つ目を作ろうとした失敗も、タグとして出る', () => {
    const view = toCreateAccountView('たろう', err({ kind: 'alreadyRegistered' }))

    expect(view.kind === 'invalid' && view.message).toContain('すでに mmkn を使いはじめて')
  })

  it('本人であることが確かめられていなければ、その旨が出る', () => {
    const view = toCreateAccountView('たろう', err({ kind: 'notAuthenticated' }))

    expect(view.kind === 'invalid' && view.message).toBe('ログインが必要です。')
  })
})

describe('アカウント', () => {
  it('自分の名前と、グループ一覧への導線が出る', () => {
    expect(toAccountView(ok(taro))).toEqual({ kind: 'ok', name: 'たろう', groupsHref: '/' })
  })

  it('ログインしていなければ、その旨とログインへの導線が出る', () => {
    const view = toAccountView(err({ kind: 'notAuthenticated' }))

    expect(view.kind).toBe('notAuthenticated')
    expect(view.kind === 'notAuthenticated' && view.loginHref).toBe('/login')
  })
})

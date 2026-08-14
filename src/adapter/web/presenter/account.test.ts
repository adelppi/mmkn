import { describe, expect, it } from 'vitest'
import { USER_NAME_MAX_LENGTH } from '../../../domain/group/text'
import { err, ok } from '../../../domain/result'
import { taro } from '../../../usecase/fixture'
import {
  initialCreateAccountView,
  initialRemoveLoginMethodView,
  toAccountView,
  toCreateAccountView,
  toLoginView,
  toRemoveLoginMethodView,
} from './account'

describe('ログイン画面', () => {
  it('渡されたログイン手段をそのまま並べる', () => {
    const view = toLoginView(['google', 'discord'])

    expect(view.choices.map((choice) => choice.action)).toEqual([
      'Google で続ける',
      'Discord で続ける',
    ])
  })

  it('知らないサービスが増えても、そのまま並ぶ（画面を作り直さない）', () => {
    const view = toLoginView(['github'])

    expect(view.choices).toEqual([
      { service: 'github', label: 'github', action: 'github で続ける' },
    ])
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

describe('ログイン手段の管理', () => {
  const output = (services: readonly string[]) =>
    ok({
      user: taro,
      loginMethods: services.map((service) => ({ service, id: `${service}-1` })),
    })

  it('使えるサービスが、追加済みかどうかと一緒に並ぶ', () => {
    const view = toAccountView(['google', 'discord'], output(['google']))

    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return

    expect(view.methods).toEqual([
      { service: 'google', label: 'Google', connected: true, status: 'ログインに使えます' },
      { service: 'discord', label: 'Discord', connected: false, status: 'まだ使えません' },
    ])
  })

  it('ログイン手段が 1 つのときは、増やすよう促す', () => {
    const view = toAccountView(['google', 'discord'], output(['google']))

    expect(view.kind === 'ok' && view.atRisk).toBe(true)
    expect(view.kind === 'ok' && view.encouragement).toContain('すべて失うと')
  })

  it('2 つ以上あれば、促し方を強めない', () => {
    const view = toAccountView(['google', 'discord'], output(['google', 'discord']))

    expect(view.kind === 'ok' && view.atRisk).toBe(false)
  })

  it('ログインしていなければ、その旨とログインへの導線が出る', () => {
    const view = toAccountView(['google'], err({ kind: 'notAuthenticated' }))

    expect(view.kind).toBe('notAuthenticated')
    expect(view.kind === 'notAuthenticated' && view.loginHref).toBe('/login')
  })
})

describe('ログイン手段の削除', () => {
  it('初期状態は何も起きていない', () => {
    expect(initialRemoveLoginMethodView()).toEqual({ kind: 'idle' })
  })

  it('削除できたら、その手段で入れなくなったことを伝える', () => {
    const view = toRemoveLoginMethodView('discord', ok(undefined))

    expect(view.kind).toBe('removed')
    expect(view.kind === 'removed' && view.message).toBe(
      'Discord でログインできなくなりました。',
    )
  })

  it('最後の 1 つの削除は、失敗のタグとして出る（画面側で判定しない）', () => {
    const view = toRemoveLoginMethodView('google', err({ kind: 'lastLoginMethod' }))

    expect(view.kind).toBe('failed')
    expect(view.kind === 'failed' && view.message).toContain('最後のログイン手段は削除できません')
  })

  it('ログイン手段でないサービスの削除も、失敗のタグとして出る', () => {
    const view = toRemoveLoginMethodView('discord', err({ kind: 'notALoginMethod' }))

    expect(view.kind).toBe('failed')
  })
})

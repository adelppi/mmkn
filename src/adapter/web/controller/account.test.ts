import { describe, expect, it, vi } from 'vitest'
import { err, ok } from '../../../domain/result'
import { taro } from '../../../usecase/fixture'
import { initialCreateAccountView, initialRemoveLoginMethodView } from '../presenter/account'
import { createAccount, removeLoginMethod } from './account'

const form = (entries: Record<string, string>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(entries)) data.append(name, value)
  return data
}

describe('アカウントを作成する', () => {
  it('打たれた名前と、確かめられた識別子をユースケースに渡す', async () => {
    const usecase = vi.fn(async () => ok(taro))

    await createAccount({ createAccount: usecase, loginIdentifier: 'auth-1' })(
      initialCreateAccountView(),
      form({ name: '  たろう  ' }),
    )

    expect(usecase).toHaveBeenCalledWith({ loginIdentifier: 'auth-1', name: '  たろう  ' })
  })

  it('ログイン識別子は入力から取らない', async () => {
    const usecase = vi.fn(async () => ok(taro))

    await createAccount({ createAccount: usecase, loginIdentifier: 'auth-1' })(
      initialCreateAccountView(),
      form({ name: 'たろう', loginIdentifier: 'auth-someone-else' }),
    )

    expect(usecase).toHaveBeenCalledWith({ loginIdentifier: 'auth-1', name: 'たろう' })
  })

  it('本人であることが確かめられていなければ、ユースケースを呼ばない', async () => {
    const usecase = vi.fn(async () => ok(taro))

    const view = await createAccount({ createAccount: usecase, loginIdentifier: undefined })(
      initialCreateAccountView(),
      form({ name: 'たろう' }),
    )

    expect(usecase).not.toHaveBeenCalled()
    expect(view.kind === 'invalid' && view.message).toBe('ログインが必要です。')
  })

  it('失敗はビューモデルのタグとして戻る', async () => {
    const view = await createAccount({
      createAccount: async () => err({ kind: 'nameTooLong' as const }),
      loginIdentifier: 'auth-1',
    })(initialCreateAccountView(), form({ name: 'あ'.repeat(21) }))

    expect(view.kind).toBe('invalid')
  })
})

describe('ログイン手段を削除する', () => {
  it('選ばれたサービスと、操作する User を渡す', async () => {
    const usecase = vi.fn(async () => ok(undefined))

    await removeLoginMethod({ removeLoginMethod: usecase, actor: taro.id })(
      initialRemoveLoginMethodView(),
      form({ service: 'discord' }),
    )

    expect(usecase).toHaveBeenCalledWith({ actor: taro.id, service: 'discord' })
  })

  it('最後の 1 つかどうかを、ここでは見ない', async () => {
    const usecase = vi.fn(async () => err({ kind: 'lastLoginMethod' as const }))

    const view = await removeLoginMethod({ removeLoginMethod: usecase, actor: taro.id })(
      initialRemoveLoginMethodView(),
      form({ service: 'google' }),
    )

    // 呼んだうえで、ドメイン層が返した失敗をそのままタグにしている。
    expect(usecase).toHaveBeenCalled()
    expect(view.kind).toBe('failed')
  })
})

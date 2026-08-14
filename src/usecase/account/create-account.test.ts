import { describe, expect, it } from 'vitest'
import { fakeIdGenerator, fakeUserRepository } from '../port/fake'
import { createAccount } from './create-account'

/**
 * **Group・Member が作られないこと、連携する外部アカウントが増えないことは、
 * このユースケースがそれらのポートを受け取っていないことで担保している**
 * （`docs/domain/group.md`「アカウントを作成する」の「起きないこと」）。
 * 触れる先が無いため、偽実装を渡して確かめる形にはしていない。
 */
const deps = (existing: Parameters<typeof fakeUserRepository>[0] = []) => ({
  users: fakeUserRepository(existing),
  ids: fakeIdGenerator('user'),
})

describe('アカウントを作成する', () => {
  it('User ができ、名前とログイン識別子が入る', async () => {
    const d = deps()

    const result = await createAccount(d)({ loginIdentifier: 'google:sub-1', name: 'たろう' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.name).toBe('たろう')
    expect(result.value.loginIdentifier).toBe('google:sub-1')
    expect(d.users.stored()).toHaveLength(1)
  })

  it('前後の空白は落とす', async () => {
    const d = deps()

    const result = await createAccount(d)({ loginIdentifier: 'google:sub-1', name: '  たろう  ' })

    expect(result.ok && result.value.name).toBe('たろう')
  })

  it('作成した User でログインできる', async () => {
    const d = deps()

    await createAccount(d)({ loginIdentifier: 'google:sub-1', name: 'たろう' })

    expect(await d.users.findByLoginIdentifier('google:sub-1')).toBeDefined()
  })

  it('同じログイン識別子の User は 2 つできない', async () => {
    const d = deps()
    await createAccount(d)({ loginIdentifier: 'google:sub-1', name: 'たろう' })

    const result = await createAccount(d)({ loginIdentifier: 'google:sub-1', name: 'じろう' })

    expect(result).toEqual({ ok: false, error: { kind: 'loginIdentifierTaken' } })
    // 既にいる User は変わらない。
    expect(d.users.stored()).toHaveLength(1)
    expect(d.users.stored()[0]?.name).toBe('たろう')
  })

  it('名前が空なら失敗し、User は作られない', async () => {
    const d = deps()

    const result = await createAccount(d)({ loginIdentifier: 'google:sub-1', name: '   ' })

    expect(result).toEqual({ ok: false, error: { kind: 'nameEmpty' } })
    expect(d.users.stored()).toHaveLength(0)
  })

  it('名前が 20 文字を超えるなら失敗し、User は作られない', async () => {
    const d = deps()

    const result = await createAccount(d)({
      loginIdentifier: 'google:sub-1',
      name: 'あ'.repeat(21),
    })

    expect(result).toEqual({ ok: false, error: { kind: 'nameTooLong' } })
    expect(d.users.stored()).toHaveLength(0)
  })

  it('識別子が違えば、同じ名前の User を作れる', async () => {
    const d = deps()
    await createAccount(d)({ loginIdentifier: 'google:sub-1', name: 'たろう' })

    const result = await createAccount(d)({ loginIdentifier: 'google:sub-2', name: 'たろう' })

    expect(result.ok).toBe(true)
    expect(d.users.stored()).toHaveLength(2)
  })
})

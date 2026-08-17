import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * リクエストの入口（`docs/adr/0008-layer-internals.md`「どのリクエストで更新するか」）。
 *
 * 確かめるのは 2 つ。
 *
 * - **更新するものが無いリクエストでは、認証基盤に問い合わせない**
 * - **画面の先読みは素通ししない。** 見分けられないため、実際の遷移と同じに扱う
 *   （`docs/adr/0009-web-ui.md`「直前に見たものを取り直さない」）
 *
 * **ここは認可を判定しない。** 通す・通さないの判定はドメイン層にあり（`docs/adr/0005`）、
 * このテストもそれを確かめない。見るのは「問い合わせが起きたかどうか」だけである。
 */

const hasSessionCookie = vi.fn()
const createAuthClient = vi.fn()
const refreshSession = vi.fn()

vi.mock('@/src/infra/auth/client', () => ({
  hasSessionCookie: (...args: unknown[]) => hasSessionCookie(...args),
  createAuthClient: (...args: unknown[]) => createAuthClient(...args),
}))

vi.mock('@/src/infra/auth/session', () => ({
  refreshSession: (...args: unknown[]) => refreshSession(...args),
}))

const { config, proxy } = await import('@/proxy')

/** 先読みの印。**中身まで取りにいく先読みには付かない**（実測。だから見分けられない）。 */
const PREFETCH = 'next-router-prefetch'

const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, 'http://localhost'), { headers })

beforeEach(() => {
  vi.clearAllMocks()
  createAuthClient.mockReturnValue({})
  refreshSession.mockResolvedValue(undefined)
})

describe('どのリクエストで更新するか', () => {
  it('セッションを持たない人には、認証基盤への往復を挟まない', async () => {
    hasSessionCookie.mockReturnValue(false)

    await proxy(request('/groups/g1'))

    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('セッションを持つ人には、更新を起こす', async () => {
    hasSessionCookie.mockReturnValue(true)

    await proxy(request('/groups/g1'))

    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('先読みの印が付いていても、同じに扱う', async () => {
    hasSessionCookie.mockReturnValue(true)

    await proxy(request('/groups/g1/balances', { [PREFETCH]: '1' }))

    // **見分けないことを、ここで固定する。** 中身まで取りにいく先読みはこの印を持たず、
    // 実際の遷移と同じ形で届くため、印の有無で扱いを変えると片方だけが素通しされる。
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })
})

describe('入口を通さないもの', () => {
  /** `matcher` は path の形で書く。**ここで組み立てるのは、その形を確かめるためだけである。** */
  const passesThrough = (path: string) =>
    !config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path))

  it('セッションを持たないものは、入口に届く前に外れる', () => {
    // 署名付きのエンドポイント（`docs/adr/0006`）と、静的ファイル・フレームワークの内部。
    expect(passesThrough('/api/discord')).toBe(true)
    expect(passesThrough('/_next/static/chunk.js')).toBe(true)
    expect(passesThrough('/favicon.ico')).toBe(true)
    expect(passesThrough('/logo.png')).toBe(true)
  })

  it('ログインの往復の戻り先も外れる（そこは自分で cookie を書ける）', () => {
    expect(passesThrough('/auth/callback')).toBe(true)
  })

  it('画面は通る', () => {
    expect(passesThrough('/')).toBe(false)
    expect(passesThrough('/groups/g1')).toBe(false)
    expect(passesThrough('/groups/g1/balances')).toBe(false)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 署名の検証に使う公開鍵（`jwks.ts`）。
 *
 * **確かめるのは 2 つ。** リクエストごとに取り直さないこと（`docs/adr/0008-layer-internals.md`
 * 「セッションの検証」）と、**取れなかったときに握りつぶさないこと**である。
 *
 * モジュールスコープに持つものを試すため、各テストでモジュールを読み直す。
 */

const AUTH_URL = 'https://auth.test'
const JWKS_URL = `${AUTH_URL}/auth/v1/.well-known/jwks.json`

const KEY = { kty: 'EC', kid: 'k1', alg: 'ES256', key_ops: ['verify'] }

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response

/** 読み直した `jwks.ts`。**モジュールスコープが空の状態から始まる。** */
const freshJwks = async () => {
  vi.resetModules()
  return await import('./jwks')
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', AUTH_URL)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('取りに行く先', () => {
  it('SUPABASE_URL の配布先だけを読む', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)

    await (await freshJwks()).verificationKeys()

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(JWKS_URL)
  })

  it('SUPABASE_URL が無ければ落ちる', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('取りに行ってはいけない')
      }),
    )

    // **設定漏れを空の鍵として飲み込まない。** 飲み込むと、遅くなった理由が分からなくなる。
    await expect((await freshJwks()).verificationKeys()).rejects.toThrow('SUPABASE_URL')
  })
})

describe('偽の認証のとき', () => {
  it('鍵を取りに行かない。配布先の設定が無くても落ちない', async () => {
    // E2E が起動するアプリには `SUPABASE_URL` を渡さない（`playwright.config.ts`）。
    // **偽の認証は署名を持たないため、鍵も要らない**（`docs/adr/0010-testing.md`
    // 「E2E が使う認証基盤」）。ここで落ちると、E2E のログインがすべて失敗する。
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('E2E_AUTH_STUB', '1')
    const fetchMock = vi.fn(() => {
      throw new Error('取りに行ってはいけない')
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await (await freshJwks()).verificationKeys()).toEqual({ keys: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('偽の認証でなければ、これまでどおり取りに行く', async () => {
    vi.stubEnv('E2E_AUTH_STUB', '')
    const fetchMock = vi.fn().mockResolvedValue(ok({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await (await freshJwks()).verificationKeys()).toEqual({ keys: [KEY] })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(JWKS_URL)
  })
})

describe('リクエストごとに取り直さない', () => {
  it('2 回目からは取りに行かない', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)
    const { verificationKeys } = await freshJwks()

    const first = await verificationKeys()
    const second = await verificationKeys()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
    expect(second.keys).toEqual([KEY])
  })

  it('同時に来ても往復は 1 回で済む', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)
    const { verificationKeys } = await freshJwks()

    const [a, b, c] = await Promise.all([
      verificationKeys(),
      verificationKeys(),
      verificationKeys(),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect([a, b, c].map(({ keys }) => keys)).toEqual([[KEY], [KEY], [KEY]])
  })
})

describe('取れなかったとき', () => {
  it('落ちずに空を返す。検証は認証基盤の側に戻るだけで、正しさは変わらない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('繋がらない')))

    expect(await (await freshJwks()).verificationKeys()).toEqual({ keys: [] })
  })

  it('鍵が配られていなければ（対称鍵に戻っていれば）空を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ keys: [] })))

    expect(await (await freshJwks()).verificationKeys()).toEqual({ keys: [] })
  })

  it('取れなかった結果は覚えない。次の呼び出しで取り直す', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('繋がらない'))
      .mockResolvedValue(ok({ keys: [KEY] }))
    vi.stubGlobal('fetch', fetchMock)
    const { verificationKeys } = await freshJwks()

    expect(await verificationKeys()).toEqual({ keys: [] })
    expect(await verificationKeys()).toEqual({ keys: [KEY] })
  })
})

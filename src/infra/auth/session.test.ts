import { createServerClient } from '@supabase/ssr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthClient, Cookie } from './client'

/**
 * セッションの検証（`session.ts` の `currentLoginIdentifier`）。
 *
 * **本物の認証基盤の SDK に対して確かめる。** 確かめたいのは
 * 「cookie の中身をそのまま信じないこと」と「そのために認証基盤へ出ないこと」であり、
 * どちらも偽の接続に置き換えると消えてしまう（`docs/adr/0008-layer-internals.md`「セッションの検証」）。
 *
 * ここが確かめないもの:
 *
 * - 認証基盤が実際に非対称鍵で署名しているか。**外れても壊れず遅くなるだけで、テストには出ない。**
 *   手順は `docs/operations.md`「診断」＞「セッションの署名方式」が正である
 * - 期限切れが入口で更新されること（`proxy.ts`）。**cookie の書き戻しはブラウザの側にしか現れない**
 */

const AUTH_URL = 'https://auth.test'
const JWKS_URL = `${AUTH_URL}/auth/v1/.well-known/jwks.json`
const SESSION_COOKIE = 'sb-test-auth-token'
const KID = 'test-signing-key'
const LOGIN_IDENTIFIER = '11111111-1111-1111-1111-111111111111'

const ES256 = { name: 'ECDSA', namedCurve: 'P-256' } as const

const text = (value: string): string => Buffer.from(value, 'utf8').toString('base64url')
const bytes = (value: ArrayBuffer): string => Buffer.from(value).toString('base64url')

/** 署名する鍵と、配られる公開鍵の対。**認証基盤が持つものにあたる。** */
const signingKeyPair = async (kid: string) => {
  const pair = await crypto.subtle.generateKey(ES256, true, ['sign', 'verify'])
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey)

  return { privateKey: pair.privateKey, publicJwk: { ...exported, kid, alg: 'ES256' } }
}

/** その鍵で署名したトークン。 */
const signedToken = async (
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
): Promise<string> => {
  const signingInput = `${text(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: KID }))}.${text(
    JSON.stringify(claims),
  )}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${bytes(signature)}`
}

const secondsFromNow = (seconds: number): number => Math.floor(Date.now() / 1000) + seconds

const claimsFor = (exp: number) => ({
  iss: `${AUTH_URL}/auth/v1`,
  sub: LOGIN_IDENTIFIER,
  aud: 'authenticated',
  role: 'authenticated',
  exp,
  iat: secondsFromNow(-60),
  session_id: '22222222-2222-2222-2222-222222222222',
})

/** ブラウザが持っているセッションの cookie。**`@supabase/ssr` が書くのと同じ形。** */
const sessionCookie = (name: string, accessToken: string): Cookie => ({
  name,
  value: `base64-${Buffer.from(
    JSON.stringify({
      access_token: accessToken,
      refresh_token: 'refresh-token',
      // **トークンそのものの `exp` とは別の値である。** 検証が見るのは `exp` の方。
      expires_at: secondsFromNow(3600),
      token_type: 'bearer',
      user: { id: LOGIN_IDENTIFIER },
    }),
    'utf8',
  ).toString('base64url')}`,
})

let requests = 0

/**
 * そのトークンを持つリクエストの接続。**本物と同じ作り方をする。**
 *
 * **接続ごとに cookie の名前を変える。** 認証基盤の SDK も鍵を使い回すため、名前を揃えると
 * 「鍵がモジュールスコープに残っているから往復が起きない」のか「SDK が使い回しているだけ」なのかを
 * 区別できなくなる。**確かめたいのは前者だけである。**
 */
const requestWith = (accessToken?: string): AuthClient => {
  const name = `${SESSION_COOKIE}-${++requests}`
  const cookies = accessToken === undefined ? [] : [sessionCookie(name, accessToken)]

  return createServerClient(AUTH_URL, 'anon-key', {
    cookies: { getAll: () => cookies, setAll: () => {} },
    cookieOptions: { name },
  })
}

/** 読み直した `session.ts`。**公開鍵のモジュールスコープが空の状態から始まる。** */
const freshSession = async () => {
  vi.resetModules()
  return await import('./session')
}

let signing: Awaited<ReturnType<typeof signingKeyPair>>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  signing = await signingKeyPair(KID)
  vi.stubEnv('SUPABASE_URL', AUTH_URL)

  // **公開鍵の配布先だけが応える。** 認証基盤への往復はここで落ちるため、
  // 「問い合わせに戻っていないこと」がテストの失敗として出る。
  fetchMock = vi.fn(async (input: unknown) => {
    if (String(input) !== JWKS_URL) throw new Error(`認証基盤へ出ている: ${String(input)}`)
    return { ok: true, json: async () => ({ keys: [signing.publicJwk] }) } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('期限内のセッション', () => {
  it('署名を検証してログイン識別子を返す', async () => {
    const token = await signedToken(signing.privateKey, claimsFor(secondsFromNow(3600)))
    const { currentLoginIdentifier } = await freshSession()

    const identifier = await currentLoginIdentifier(requestWith(token))

    expect(identifier).toBe(LOGIN_IDENTIFIER)
  })

  it('鍵が手元にあれば、認証基盤への HTTP は 0 回になる', async () => {
    const token = await signedToken(signing.privateKey, claimsFor(secondsFromNow(3600)))
    const { currentLoginIdentifier } = await freshSession()

    // 1 回目は公開鍵を取りに行く。**その 1 回だけがモジュールスコープに残る。**
    await currentLoginIdentifier(requestWith(token))
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(JWKS_URL)

    // **2 回目以降が本題。** 別のリクエストの接続でも、往復は 1 回も増えない。
    await currentLoginIdentifier(requestWith(token))
    await currentLoginIdentifier(requestWith(token))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('信じてはいけない cookie', () => {
  it('署名が別の鍵のものなら、ログインしていない扱いになる', async () => {
    const forged = await signingKeyPair(KID)
    const token = await signedToken(forged.privateKey, claimsFor(secondsFromNow(3600)))
    const { currentLoginIdentifier } = await freshSession()

    expect(await currentLoginIdentifier(requestWith(token))).toBeUndefined()
  })

  it('署名の後で中身を書き換えたら、ログインしていない扱いになる', async () => {
    const token = await signedToken(signing.privateKey, claimsFor(secondsFromNow(3600)))
    const [header, , signature] = token.split('.')
    const tampered = [
      header,
      text(JSON.stringify({ ...claimsFor(secondsFromNow(3600)), sub: 'someone-else' })),
      signature,
    ].join('.')
    const { currentLoginIdentifier } = await freshSession()

    expect(await currentLoginIdentifier(requestWith(tampered))).toBeUndefined()
  })

  it('期限が切れたトークンなら、ログインしていない扱いになる', async () => {
    const token = await signedToken(signing.privateKey, claimsFor(secondsFromNow(-1)))
    const { currentLoginIdentifier } = await freshSession()

    expect(await currentLoginIdentifier(requestWith(token))).toBeUndefined()
  })

  it('トークンの形をなしていなければ、ログインしていない扱いになる', async () => {
    const { currentLoginIdentifier } = await freshSession()

    expect(await currentLoginIdentifier(requestWith('not-a-jwt'))).toBeUndefined()
  })

  it('セッションの cookie が無ければ、ログインしていない扱いになる', async () => {
    const { currentLoginIdentifier } = await freshSession()

    expect(await currentLoginIdentifier(requestWith())).toBeUndefined()
  })
})

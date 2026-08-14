import { describe, expect, it } from 'vitest'
import { verifySignature } from './signature'

/**
 * 署名検証（`docs/adr/0006-discord-http-interactions.md`「エンドポイントの要件」）。
 *
 * **これが認証そのものである。** 通ることで「Discord から来たこと」と、リクエストに含まれる
 * ユーザー ID が保証される。**通らないものを通すと、誰でも他人の記録を書ける。**
 */

const toHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

const keyPair = async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair

  return {
    publicKey: toHex(await crypto.subtle.exportKey('raw', pair.publicKey)),
    sign: async (message: string) =>
      toHex(
        await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(message)),
      ),
  }
}

const timestamp = '1770000000'
const body = '{"type":1}'

describe('署名検証', () => {
  it('正しい署名は通る', async () => {
    const { publicKey, sign } = await keyPair()

    const verified = await verifySignature({
      publicKey,
      signature: await sign(`${timestamp}${body}`),
      timestamp,
      body,
    })

    expect(verified).toBe(true)
  })

  it('本文が差し替えられていたら通らない', async () => {
    const { publicKey, sign } = await keyPair()

    const verified = await verifySignature({
      publicKey,
      signature: await sign(`${timestamp}${body}`),
      timestamp,
      body: '{"type":2}',
    })

    expect(verified).toBe(false)
  })

  it('別の鍵で署名されていたら通らない', async () => {
    const mine = await keyPair()
    const other = await keyPair()

    const verified = await verifySignature({
      publicKey: mine.publicKey,
      signature: await other.sign(`${timestamp}${body}`),
      timestamp,
      body,
    })

    expect(verified).toBe(false)
  })

  it('署名やタイムスタンプが無ければ通らない', async () => {
    const { publicKey } = await keyPair()

    expect(await verifySignature({ publicKey, signature: null, timestamp, body })).toBe(false)
    expect(
      await verifySignature({ publicKey, signature: '00'.repeat(64), timestamp: null, body }),
    ).toBe(false)
  })

  it('16 進として読めない値でも例外を投げず、通らないとして返す', async () => {
    const { publicKey } = await keyPair()

    expect(await verifySignature({ publicKey, signature: 'ぜんぜんちがう', timestamp, body })).toBe(
      false,
    )
    expect(await verifySignature({ publicKey: 'xyz', signature: '00', timestamp, body })).toBe(false)
  })
})

/**
 * Interaction の署名検証（`docs/adr/0006-discord-http-interactions.md`「エンドポイントの要件」）。
 *
 * **これが認証そのものである。** 検証が通ることで「Discord から来たこと」と、リクエストに
 * 含まれるユーザー ID が保証される。**したがってエンドポイントの入口に置き、
 * 検証を通っていないリクエストからは何も読まない。**
 *
 * 標準の暗号 API（WebCrypto）を使うため、**Node.js ランタイムを明示指定する**必要がある
 * （Edge ランタイム不可。指定は `app/api/discord/route.ts`）。
 */

/** 検証に必要な 2 つのヘッダの名前。**どちらか欠けていれば検証は通らない。** */
export const SIGNATURE_HEADER = 'x-signature-ed25519'
export const TIMESTAMP_HEADER = 'x-signature-timestamp'

const HEX = /^[0-9a-fA-F]*$/

const fromHex = (hex: string): Uint8Array<ArrayBuffer> | undefined => {
  if (hex.length % 2 !== 0 || !HEX.test(hex)) return undefined

  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export type SignedRequest = {
  /** Discord のアプリケーションの公開鍵（16 進）。**Bot Token とは別物。** */
  readonly publicKey: string
  readonly signature: string | null
  readonly timestamp: string | null
  /** **本文は生のまま渡す。** 一度 JSON にして戻すと署名の対象と一致しなくなる。 */
  readonly body: string
}

/**
 * 署名を検証する。**通らなければ `false`。**
 *
 * **例外を投げない。** 鍵や署名が読めない形をしていることと、署名が一致しないことは、
 * 呼び出し側から見れば同じ「Discord から来たとは言えない」であり、どちらも 401 になる。
 */
export const verifySignature = async (request: SignedRequest): Promise<boolean> => {
  if (request.signature === null || request.timestamp === null) return false

  const key = fromHex(request.publicKey)
  const signature = fromHex(request.signature)
  if (key === undefined || signature === undefined) return false

  try {
    const publicKey = await crypto.subtle.importKey('raw', key, { name: 'Ed25519' }, false, [
      'verify',
    ])

    return await crypto.subtle.verify(
      'Ed25519',
      publicKey,
      signature,
      new TextEncoder().encode(`${request.timestamp}${request.body}`),
    )
  } catch {
    return false
  }
}

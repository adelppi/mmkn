/**
 * E2E が使う署名鍵（`docs/adr/0010-testing.md`「E2E の範囲」）。
 *
 * **Discord の鍵ではない。** ここで署名するのは E2E 自身であり、確かめたいのは
 * 「**自分で署名したリクエストが、自分のエンドポイントを通ること**」である。
 * 正しい署名を Discord 側の鍵で作ることはできない（秘密鍵はこちらに無い）。
 *
 * **秘密情報ではない。** この鍵で守るものが無く、使うのは CI 内で起動したアプリだけである
 * （手元の Postgres の利用者名と同じ扱い。`docs/operations.md`「手元の準備」）。
 * **ホスティング環境の `DISCORD_PUBLIC_KEY` はこれとは別物で、Discord が発行したものが入る。**
 */

/** アプリに渡す公開鍵（16 進）。`DISCORD_PUBLIC_KEY` として起動時に渡す。 */
export const E2E_DISCORD_PUBLIC_KEY =
  'debb6273c1bad4c8bc22a4d3adacada8adf44fc7429838f30c4e09b1e97b8b26'

/** 署名に使う秘密鍵（PKCS#8 / base64）。**E2E の中だけで使う。** */
const E2E_DISCORD_PRIVATE_KEY =
  'MC4CAQAwBQYDK2VwBCIEIOI2yBioXVtLziERXVPRn8iXDk0bPLwhq8AtDIgXkU1m'

const decode = (base64: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

/**
 * Discord と同じ形で署名する（`src/infra/discord/signature.ts` が検証する形）。
 *
 * **署名の対象はタイムスタンプと生の本文の連結である。** 本文は送るものと同じ文字列を渡す
 * （一度 JSON にして戻すと一致しなくなる）。
 */
export const signInteraction = async (
  body: string,
  timestamp: string,
): Promise<{ readonly signature: string; readonly timestamp: string }> => {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    decode(E2E_DISCORD_PRIVATE_KEY),
    { name: 'Ed25519' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'Ed25519',
    key,
    new TextEncoder().encode(`${timestamp}${body}`),
  )

  return { signature: toHex(new Uint8Array(signature)), timestamp }
}

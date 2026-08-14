import { expect, test } from '@playwright/test'
import { signInteraction } from './support/discord-key'

/**
 * Discord のエンドポイント（`docs/adr/0010-testing.md`「E2E の範囲」）。
 *
 * **自分で署名したリクエストを、自分のエンドポイントへ投げる。** 確かめるのは、
 * 署名検証が入口として実際に効いていること（`docs/adr/0006-discord-http-interactions.md`）である。
 *
 * **follow-up の送信は見ない。** それは Discord の API への外向きの通信であり、
 * **どちらの経路もリポジトリの中にあるものだけで完結させる**（`docs/adr/0011-ci-and-release.md`
 * 「定期実行するものを持たない」）。届くかどうかの確認は
 * `docs/operations.md`「実装着手時に必ず確かめること」の手動確認が正。
 */

const ENDPOINT = '/api/discord'

/** `PING`。**follow-up を持たない唯一の種別**（`src/adapter/discord/router.ts`）。 */
const ping = JSON.stringify({
  id: '1',
  application_id: '1',
  type: 1,
  token: 'e2e',
  version: 1,
})

test('自分で署名した Interaction が通る', async ({ request }) => {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const { signature } = await signInteraction(ping, timestamp)

  const response = await request.post(ENDPOINT, {
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': signature,
      'x-signature-timestamp': timestamp,
    },
    data: ping,
  })

  expect(response.status()).toBe(200)
  // `PONG`。Discord がエンドポイントを登録するときに最初に確かめるもの。
  expect(await response.json()).toEqual({ type: 1 })
})

test('署名が正しくなければ 401 を返す', async ({ request }) => {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const { signature } = await signInteraction(ping, timestamp)

  const response = await request.post(ENDPOINT, {
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': signature,
      'x-signature-timestamp': timestamp,
    },
    // **署名した本文と違うものを送る。** 署名そのものは正しい形をしている。
    data: JSON.stringify({ ...JSON.parse(ping), token: 'tampered' }),
  })

  expect(response.status()).toBe(401)
})

test('署名のヘッダが無ければ 401 を返す', async ({ request }) => {
  const response = await request.post(ENDPOINT, {
    headers: { 'content-type': 'application/json' },
    data: ping,
  })

  expect(response.status()).toBe(401)
})

import { wire } from '@/app/_lib/wire'
import { route as routeInteraction } from '@/src/adapter/discord/router'
import { createAuthClient } from '@/src/infra/auth/client'
import { sendFollowUp } from '@/src/infra/discord/client'
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifySignature,
} from '@/src/infra/discord/signature'
import { isoDateOf, systemClock } from '@/src/infra/system/clock'
import type { APIInteraction } from 'discord-api-types/v10'
import { after, NextResponse, type NextRequest } from 'next/server'

/**
 * Discord の Interaction を受ける唯一の口（`docs/adr/0006-discord-http-interactions.md`）。
 *
 * ```
 * 署名検証 → 3 秒以内に応答 → 応答後に処理を続ける → follow-up
 * ```
 *
 * **Node.js ランタイムを明示指定する。** 署名検証に標準の暗号 API を使うため、
 * Edge ランタイムでは動かない（`docs/adr/0006`「エンドポイントの要件」）。
 */
export const runtime = 'nodejs'

/**
 * Discord の署名検証用公開鍵。**Bot Token とは別物で、アプリが実行時に要るのはこれだけ。**
 *
 * 置き場は `docs/operations.md`「環境変数」を正とする。
 */
const publicKey = (): string => {
  const value = process.env['DISCORD_PUBLIC_KEY']
  if (value === undefined || value === '') throw new Error('DISCORD_PUBLIC_KEY が設定されていない')
  return value
}

/**
 * Discord からの操作にセッションは無い。
 *
 * **操作の主はログイン手段の参照から解決する**（`docs/adr/0012-login.md`）。認証基盤への接続は
 * `wire()` の形をそろえるために渡すだけで、cookie を持たない。**ここを通る経路は
 * ログイン手段の参照だけであり、それは SQL で行われる**（`src/infra/auth/external-account.ts`）。
 */
const anonymousAuthClient = () => createAuthClient({ getAll: () => [], setAll: () => {} })

export async function POST(request: NextRequest) {
  const body = await request.text()

  /**
   * **署名検証が入口にある**（`docs/adr/0006`）。これが認証そのものであり、
   * 通っていないリクエストからは何も読まない。**署名不正には 401 を返す**
   * （Discord がエンドポイント登録時に要求する）。
   */
  const verified = await verifySignature({
    publicKey: publicKey(),
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    body,
  })
  if (!verified) return new NextResponse('invalid request signature', { status: 401 })

  const interaction = JSON.parse(body) as APIInteraction

  // **相関 ID は 1 Interaction で一貫する**（`docs/adr/0014-logging.md`）。
  // 応答を返したあとに続く処理も、同じ ID でログに出る。
  const correlationId = crypto.randomUUID()
  const usecases = wire({ correlationId, client: 'discord' }, anonymousAuthClient())

  const outcome = routeInteraction(usecases, {
    origin: new URL(request.url).origin,
    today: isoDateOf(systemClock.now()),
  })(interaction)

  // 扱わない種別。**「考え中」を返して続きを送らない状態を作らない。**
  if (outcome === undefined) return new NextResponse('unsupported interaction', { status: 400 })

  const followUp = outcome.followUp
  if (followUp !== undefined) {
    /**
     * **応答を返したあとに処理を続ける**（`docs/adr/0003-tech-stack.md`）。
     * 一律 deferred は、応答した時点で実行が終わる形では成立しない。
     *
     * ここが期待どおり動くかはホスティング環境の挙動に依存する。確認は
     * `docs/operations.md`「実装着手時に必ず確かめること」にある。
     */
    after(async () => {
      const { target, reply } = await followUp()

      await sendFollowUp({
        applicationId: interaction.application_id,
        interactionToken: interaction.token,
        message: { target, embeds: reply.embeds, components: reply.components },
      })
    })
  }

  return NextResponse.json(outcome.response)
}

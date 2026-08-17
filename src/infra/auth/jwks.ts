import type { JWK } from '@supabase/supabase-js'
import { requiredEnv } from './client'

/**
 * セッションの署名を検証する公開鍵（`docs/adr/0008-layer-internals.md`「セッションの検証」）。
 *
 * **モジュールスコープに持つ。** 認証基盤への接続はリクエストごとに作られる（cookie に結びつくため。
 * `client.ts`）ので、鍵をその中に置くと、**消したはずの往復の代わりに、鍵を取りに行く往復が
 * 毎回走る。**
 *
 * **`docs/adr/0003-tech-stack.md` の「プロセス内メモリに状態を保持しない」には触れない。**
 * 誰のものでもない公開の鍵であり、失われても次のリクエストで取り直されるだけである。
 */

/** 鍵の集合。**取れた分だけを持つ。** */
export type PublicKeys = { readonly keys: JWK[] }

/** **取れていない状態。** これを渡しても検証は成立する（下記「取れなかったとき」）。 */
const NONE: PublicKeys = { keys: [] }

/** 取れた鍵。**プロセスが生きている間だけ残る。** */
let cached: PublicKeys | undefined

/** 取りに行っている最中の呼び出し。**同時に来ても往復は 1 回で済ませる。** */
let pending: Promise<PublicKeys> | undefined

/**
 * 公開鍵の配布先。**読むのは `SUPABASE_URL` だけで、秘密情報を渡さない。**
 *
 * 同じ URL を人が直接叩く手順が `docs/operations.md`「診断」＞「セッションの署名方式」にある。
 */
const endpoint = (): string => `${requiredEnv('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`

const load = async (url: string): Promise<PublicKeys> => {
  const response = await fetch(url)
  if (!response.ok) return NONE

  const body: unknown = await response.json()
  const keys = (body as { keys?: JWK[] } | null)?.keys

  return Array.isArray(keys) && keys.length > 0 ? { keys } : NONE
}

/**
 * 検証に使う公開鍵。
 *
 * ## 取れなかったとき
 *
 * **空のまま返し、握りつぶしたことにしない。** 空を渡された認証基盤の SDK は、自分で鍵を取りに行き、
 * それも駄目なら問い合わせで検証する（`session.ts`）。**つまり失うのは速さだけで、正しさは変わらない。**
 * 対称鍵に戻ったとき（`docs/adr/0008`「セッションの検証」）と同じ現れ方であり、**気づく手段は
 * 検査ではなく診断である**（`docs/operations.md`「診断」＞「セッションの署名方式」）。
 *
 * **取れなかった結果は覚えない。** 覚えると、一度の失敗がプロセスの寿命のあいだ続く。
 *
 * **設定漏れはこれに当たらない。** 取りに行く先が分からないのは遅さの問題ではないため、落とす。
 *
 * ## 鍵が入れ替わったとき
 *
 * **取り直す期限を持たない。** 持っている鍵に無い署名が来ると、認証基盤の SDK が自分で取りに行く
 * （上記「取れなかったとき」と同じ経路）。**つまり入れ替わっても正しさは変わらず、
 * プロセスが入れ替わるまでの間、往復が 1 回戻るだけである。**
 */
export const verificationKeys = async (): Promise<PublicKeys> => {
  if (cached !== undefined) return cached

  const url = endpoint()
  pending ??= load(url).catch(() => NONE)
  const loaded = await pending
  pending = undefined

  if (loaded !== NONE) cached = loaded

  return loaded
}

/**
 * 接続文字列の `sslmode` を、libpq と同じ意味で読ませる。
 *
 * **ドライバの既定では意味が違う。** `sslmode=require` が証明書の検証まで求める指定として扱われ、
 * Supavisor の証明書は検証に通らないため繋がらなくなる（`docs/adr/0005`「接続の要件」）。
 * `sslmode` が無ければ何も変わらない。
 */
export const connectionString = (url: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}uselibpqcompat=true`

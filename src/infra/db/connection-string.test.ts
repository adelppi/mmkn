import { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { connectionString } from './connection-string'

/** `sslmode` の読み方（`docs/adr/0005-data-access-and-authorization.md`「接続の要件」）。 */

const URL = 'postgresql://user:p%40ss@db.example.com:6543/postgres'

/** ドライバが実際に使う値。**繋がない。** */
const read = (url: string) => {
  const { host, port, password, ssl } = new Client({ connectionString: connectionString(url) })
  return { host, port, password, ssl: ssl as unknown }
}

describe('接続文字列の sslmode', () => {
  it('無ければ TLS を使わない', () => {
    expect(read(URL).ssl).toBe(false)
  })

  it('require は TLS を使うが、証明書の検証までは求めない', () => {
    expect(read(`${URL}?sslmode=require`).ssl).toEqual({ rejectUnauthorized: false })
  })

  it('verify-full は証明書を検証する', () => {
    expect(read(`${URL}?sslmode=verify-full`).ssl).not.toHaveProperty('rejectUnauthorized', false)
  })

  it('接続先は変わらない', () => {
    expect(read(`${URL}?sslmode=require`)).toMatchObject({
      host: 'db.example.com',
      port: 6543,
      password: 'p@ss',
    })
  })
})

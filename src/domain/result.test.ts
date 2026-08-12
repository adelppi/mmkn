import { describe, expect, it } from 'vitest'
import { err, ok, type Result } from './result'

describe('Result', () => {
  it('成功は ok: true と value を持つ', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 })
  })

  it('失敗は ok: false と error を持つ', () => {
    expect(err('notMember')).toEqual({ ok: false, error: 'notMember' })
  })

  it('ok を見れば成功と失敗を見分けられる', () => {
    const results: Result<number, string>[] = [ok(1), err('notMember')]
    expect(results.map((r) => (r.ok ? r.value : r.error))).toEqual([1, 'notMember'])
  })

  it('成功のときは error を、失敗のときは value を持たない', () => {
    const success: Result<number, string> = ok(1)
    // @ts-expect-error 成功に error は無い
    expect(success.error).toBeUndefined()

    const failure: Result<number, string> = err('notMember')
    // @ts-expect-error 失敗に value は無い
    expect(failure.value).toBeUndefined()
  })
})

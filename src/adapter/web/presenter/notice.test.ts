import { describe, expect, it } from 'vitest'

import { NOTICE_PARAM, toNoticeView, unreachableNotice } from './notice'
import { route } from './route'

describe('済んだことの知らせ', () => {
  it('印から文言と色が決まる', () => {
    expect(toNoticeView('paymentRecorded')).toEqual({
      tone: 'done',
      message: '支払いを記録しました',
    })
  })

  it('削除は削除の印で出る', () => {
    expect(toNoticeView('recordDeleted')?.tone).toBe('removed')
  })

  /** **削除に取り消しは無い**（`docs/domain/record.md`「削除」）。 */
  it('知らせは文言と色しか持たない（押せるものが載らない）', () => {
    const notice = toNoticeView('recordDeleted')

    expect(notice === undefined ? [] : Object.keys(notice).sort()).toEqual(['message', 'tone'])
  })

  it('知らない印からは何も出さない', () => {
    expect(toNoticeView('recordDropped')).toBeUndefined()
    expect(toNoticeView(undefined)).toBeUndefined()
  })

  /** 届かなかったときだけの文言（届いた失敗は `messageOf` が持つ）。 */
  it('届かなかったときは取り消しのきかない色で出る', () => {
    expect(unreachableNotice().tone).toBe('failed')
  })
})

describe('知らせを行き先に載せる', () => {
  it('印を付けない行き先は、これまでと同じ', () => {
    expect(route.group('g1')).toBe('/groups/g1')
  })

  it('付けた印は、行き先から読み戻せる', () => {
    const href = route.group('g1', 'transferRecorded')

    expect(href).toBe('/groups/g1?notice=transferRecorded')
    expect(toNoticeView(new URL(href, 'https://mmkn.test').searchParams.get(NOTICE_PARAM) ?? undefined)).toEqual({
      tone: 'done',
      message: '送金を記録しました',
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  constrainText,
  DISPLAY_NAME_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from './text'

describe('文字列の入力制約', () => {
  describe('上限', () => {
    it('グループ名 50 / 表示名 20 / User の名前 20', () => {
      expect(GROUP_NAME_MAX_LENGTH).toBe(50)
      expect(DISPLAY_NAME_MAX_LENGTH).toBe(20)
      expect(USER_NAME_MAX_LENGTH).toBe(20)
    })
  })

  describe('前後の空白', () => {
    it('落とす', () => {
      expect(constrainText('  たろう\n', 20)).toEqual({ ok: true, value: 'たろう' })
    })

    it('全角の空白も落とす', () => {
      expect(constrainText('　たろう　', 20)).toEqual({ ok: true, value: 'たろう' })
    })

    it('間の空白は残す', () => {
      expect(constrainText(' 山田 太郎 ', 20)).toEqual({ ok: true, value: '山田 太郎' })
    })

    it('落としたあとの長さで上限を見る', () => {
      expect(constrainText(`  ${'あ'.repeat(20)}  `, 20)).toEqual({
        ok: true,
        value: 'あ'.repeat(20),
      })
    })
  })

  describe('空', () => {
    it('空文字は失敗する', () => {
      expect(constrainText('', 20)).toEqual({ ok: false, error: 'empty' })
    })

    it('空白だけの入力も失敗する', () => {
      expect(constrainText('   ', 20)).toEqual({ ok: false, error: 'empty' })
    })
  })

  describe('上限の境界', () => {
    it('ちょうど上限なら通る', () => {
      expect(constrainText('あ'.repeat(20), 20).ok).toBe(true)
    })

    it('1 文字超えると失敗する', () => {
      expect(constrainText('あ'.repeat(21), 20)).toEqual({ ok: false, error: 'tooLong' })
    })

    it('2 つの符号単位で表される文字も 1 文字として数える', () => {
      // '🐧' は符号単位では 2 つ。20 個で上限ちょうどになる。
      expect(constrainText('🐧'.repeat(20), 20).ok).toBe(true)
      expect(constrainText('🐧'.repeat(21), 20)).toEqual({ ok: false, error: 'tooLong' })
    })
  })
})

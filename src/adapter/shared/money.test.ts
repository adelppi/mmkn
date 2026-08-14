import { describe, expect, it } from 'vitest'
import { currency } from '../../domain/money/currency'
import { amountText, currencyNameOf, moneyText, parseAmount } from './money'

const of = (code: string) => {
  const result = currency(code)
  if (!result.ok) throw new Error('前提の通貨が表に無い')
  return result.value
}

const jpy = of('JPY')
const usd = of('USD')
const bhd = of('BHD')

describe('金額の表示整形', () => {
  it('最小単位が 0 桁の通貨は、小数点を出さない', () => {
    expect(moneyText(132_800, jpy)).toMatchObject({ digits: '132,800', sign: '' })
  })

  it('最小単位が 2 桁の通貨は、2 桁の小数を出す', () => {
    expect(moneyText(1050, usd).digits).toBe('10.50')
  })

  it('最小単位が 3 桁の通貨も、その桁数で出す', () => {
    expect(moneyText(1234, bhd).digits).toBe('1.234')
  })

  it('符号を出すのは、向きを持つ値だけ', () => {
    expect(moneyText(5000, jpy, { signed: true }).sign).toBe('+')
    expect(moneyText(-5000, jpy, { signed: true }).sign).toBe('−')
    expect(moneyText(-5000, jpy).sign).toBe('')
  })

  it('過不足が無いときは符号を出さない', () => {
    expect(moneyText(0, jpy, { signed: true }).sign).toBe('')
  })

  it('負の額でも数字に符号を混ぜない', () => {
    expect(moneyText(-8400, jpy, { signed: true }).digits).toBe('8,400')
  })

  it('通貨記号が引ける', () => {
    expect(moneyText(1, jpy).symbol).toBe('￥')
  })

  it('別の通貨が同じ記号にならない（最短形に丸めない）', () => {
    expect(moneyText(1, of('TWD')).symbol).toBe('NT$')
    expect(moneyText(1, usd).symbol).toBe('$')
  })

  it('記号を持たない通貨は、通貨コードがそのまま出る', () => {
    expect(moneyText(1, bhd).symbol).toBe('BHD')
  })

  it('通貨名が引ける', () => {
    expect(currencyNameOf('JPY')).toBe('日本円')
  })
})

describe('入力された金額の読み取り', () => {
  it('最小単位が 0 桁の通貨は、整数をそのまま読む', () => {
    expect(parseAmount('48000', jpy)).toBe(48_000)
  })

  it('桁区切りが入っていても読める', () => {
    expect(parseAmount('48,000', jpy)).toBe(48_000)
  })

  it('最小単位が 2 桁の通貨は、小数を最小単位に直す', () => {
    expect(parseAmount('10.50', usd)).toBe(1050)
    expect(parseAmount('10.5', usd)).toBe(1050)
    expect(parseAmount('10', usd)).toBe(1000)
  })

  it('最小単位より細かい桁は、丸めずに読めないものとして扱う', () => {
    expect(parseAmount('10.505', usd)).toBeUndefined()
    expect(parseAmount('10.5', jpy)).toBeUndefined()
  })

  it('数字でない表記は読めない', () => {
    expect(parseAmount('', jpy)).toBeUndefined()
    expect(parseAmount('いくらか', jpy)).toBeUndefined()
    expect(parseAmount('-100', jpy)).toBeUndefined()
  })

  it('0 は読める（正の整数であることの判定はドメインが持つ）', () => {
    expect(parseAmount('0', jpy)).toBe(0)
  })
})

describe('入力欄に戻すための表記', () => {
  it('最小単位の桁数どおりに戻る', () => {
    expect(amountText(48_000, jpy)).toBe('48000')
    expect(amountText(1050, usd)).toBe('10.50')
    expect(amountText(1234, bhd)).toBe('1.234')
  })

  it('読み取りと往復しても値が変わらない', () => {
    expect(parseAmount(amountText(1050, usd), usd)).toBe(1050)
    expect(parseAmount(amountText(48_000, jpy), jpy)).toBe(48_000)
  })
})

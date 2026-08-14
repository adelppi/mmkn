import type { APIApplicationCommandOptionChoice } from 'discord-api-types/v10'
import { selectableCurrencies } from '../../../domain/money/currency'
import { currencyNameOf } from '../../shared/money'
import { take, MAX_CHOICES } from './limits'

/**
 * 通貨の入力候補（`docs/adr/0006-discord-http-interactions.md`）。
 *
 * **オートコンプリートは defer できず、3 秒以内に返しきる必要がある。**
 * そのため**候補の生成に永続化への問い合わせを含めない。** ここが読むのは
 * `domain/money` の通貨表だけで、そこはコミット済みの静的な表である（`docs/adr/0016`）。
 *
 * 引くのは**現行の通貨だけ**である。廃止された通貨をここに出すには「そのグループに既に
 * その通貨の記録があるか」を知る必要があり、それは永続化への問い合わせになる
 * （`docs/domain/money.md`「廃止された通貨」）。**通貨は引数を省略できる**ため、
 * 候補に出ないことが記録できないことを意味しない（既定通貨が使われる）。
 */
export const currencyChoices = (
  typed: string,
): readonly APIApplicationCommandOptionChoice<string>[] => {
  const needle = typed.trim().toUpperCase()

  const matched = selectableCurrencies([]).filter((code) => code.startsWith(needle))

  return take(matched, MAX_CHOICES).map((code) => ({
    name: `${code} — ${currencyNameOf(code)}`,
    value: code,
  }))
}

/**
 * ISO 4217 の通貨コードと、通貨ごとの最小単位の桁数（`docs/domain/money.md`「扱う通貨」）。
 *
 * 取得元: ISO 4217 の維持機関が配布する List One（Currency, fund and precious metal codes）の XML
 *         https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml
 * 公表日: 2026-01-01（XML のルート要素の `Pblshd`。書き写した時点で配布されていた版）
 *
 * **この表は人が直接編集する。生成器も定期実行も持たない**（`docs/adr/0016-currency-table-committed.md`）。
 * 直す手順は `docs/operations.md`「通貨表の更新」を正とする。**行が消える差分を作らない。**
 *
 * 公表データは国単位のエントリ（280 件）で、通貨コードは 178 種。ここに写したのはそのうち
 * **最小単位の桁数が数値で定められている 165 種**だけである。桁数が `N.A.` の 13 種
 * （貴金属・特別引出権・テスト用のコードなど）は、金額として解釈できないため扱わない
 * （`docs/domain/money.md`「最小単位を持たない通貨コードは扱わない」）。桁数を補って入れることはしない。
 *
 * 値が ISO 4217 と一致することはテストで確かめられない。**形（コードの重複・桁数）だけを
 * `currency-table.test.ts` が見る。値の正しさはレビューが担保する**（`docs/adr/0016`）。
 */

/** 通貨表の 1 行。 */
export type CurrencyEntry = {
  /** ISO 4217 の通貨コード。 */
  readonly code: string
  /**
   * 最小単位の桁数。**mmkn 側で独自に決めない**（`docs/domain/money.md`）。
   *
   * ISO 4217 から削除されても、**削除された時点の桁数をそのまま使い続ける。**
   * 削除を境に過去の記録の金額の解釈が変わってはいけないため、この値は消さない。
   */
  readonly minorUnit: number
  /**
   * ISO 4217 から削除された通貨に立てる印（`docs/domain/money.md`「廃止された通貨」）。
   *
   * **印が立っても扱いは現行の通貨と何も変わらない。** 変わるのは入力候補に出すかどうかだけで、
   * 記録・収支・清算案はそのまま導出され続ける。印は人が立てる（`docs/operations.md`）。
   */
  readonly withdrawn?: true
}

/** 通貨コードの昇順。並びは入力候補の並びにそのまま使う。 */
export const currencyTable: readonly CurrencyEntry[] = [
  { code: 'AED', minorUnit: 2 }, // UAE Dirham
  { code: 'AFN', minorUnit: 2 }, // Afghani
  { code: 'ALL', minorUnit: 2 }, // Lek
  { code: 'AMD', minorUnit: 2 }, // Armenian Dram
  { code: 'AOA', minorUnit: 2 }, // Kwanza
  { code: 'ARS', minorUnit: 2 }, // Argentine Peso
  { code: 'AUD', minorUnit: 2 }, // Australian Dollar
  { code: 'AWG', minorUnit: 2 }, // Aruban Florin
  { code: 'AZN', minorUnit: 2 }, // Azerbaijan Manat
  { code: 'BAM', minorUnit: 2 }, // Convertible Mark
  { code: 'BBD', minorUnit: 2 }, // Barbados Dollar
  { code: 'BDT', minorUnit: 2 }, // Taka
  { code: 'BHD', minorUnit: 3 }, // Bahraini Dinar
  { code: 'BIF', minorUnit: 0 }, // Burundi Franc
  { code: 'BMD', minorUnit: 2 }, // Bermudian Dollar
  { code: 'BND', minorUnit: 2 }, // Brunei Dollar
  { code: 'BOB', minorUnit: 2 }, // Boliviano
  { code: 'BOV', minorUnit: 2 }, // Mvdol
  { code: 'BRL', minorUnit: 2 }, // Brazilian Real
  { code: 'BSD', minorUnit: 2 }, // Bahamian Dollar
  { code: 'BTN', minorUnit: 2 }, // Ngultrum
  { code: 'BWP', minorUnit: 2 }, // Pula
  { code: 'BYN', minorUnit: 2 }, // Belarusian Ruble
  { code: 'BZD', minorUnit: 2 }, // Belize Dollar
  { code: 'CAD', minorUnit: 2 }, // Canadian Dollar
  { code: 'CDF', minorUnit: 2 }, // Congolese Franc
  { code: 'CHE', minorUnit: 2 }, // WIR Euro
  { code: 'CHF', minorUnit: 2 }, // Swiss Franc
  { code: 'CHW', minorUnit: 2 }, // WIR Franc
  { code: 'CLF', minorUnit: 4 }, // Unidad de Fomento
  { code: 'CLP', minorUnit: 0 }, // Chilean Peso
  { code: 'CNY', minorUnit: 2 }, // Yuan Renminbi
  { code: 'COP', minorUnit: 2 }, // Colombian Peso
  { code: 'COU', minorUnit: 2 }, // Unidad de Valor Real
  { code: 'CRC', minorUnit: 2 }, // Costa Rican Colon
  { code: 'CUP', minorUnit: 2 }, // Cuban Peso
  { code: 'CVE', minorUnit: 2 }, // Cabo Verde Escudo
  { code: 'CZK', minorUnit: 2 }, // Czech Koruna
  { code: 'DJF', minorUnit: 0 }, // Djibouti Franc
  { code: 'DKK', minorUnit: 2 }, // Danish Krone
  { code: 'DOP', minorUnit: 2 }, // Dominican Peso
  { code: 'DZD', minorUnit: 2 }, // Algerian Dinar
  { code: 'EGP', minorUnit: 2 }, // Egyptian Pound
  { code: 'ERN', minorUnit: 2 }, // Nakfa
  { code: 'ETB', minorUnit: 2 }, // Ethiopian Birr
  { code: 'EUR', minorUnit: 2 }, // Euro
  { code: 'FJD', minorUnit: 2 }, // Fiji Dollar
  { code: 'FKP', minorUnit: 2 }, // Falkland Islands Pound
  { code: 'GBP', minorUnit: 2 }, // Pound Sterling
  { code: 'GEL', minorUnit: 2 }, // Lari
  { code: 'GHS', minorUnit: 2 }, // Ghana Cedi
  { code: 'GIP', minorUnit: 2 }, // Gibraltar Pound
  { code: 'GMD', minorUnit: 2 }, // Dalasi
  { code: 'GNF', minorUnit: 0 }, // Guinean Franc
  { code: 'GTQ', minorUnit: 2 }, // Quetzal
  { code: 'GYD', minorUnit: 2 }, // Guyana Dollar
  { code: 'HKD', minorUnit: 2 }, // Hong Kong Dollar
  { code: 'HNL', minorUnit: 2 }, // Lempira
  { code: 'HTG', minorUnit: 2 }, // Gourde
  { code: 'HUF', minorUnit: 2 }, // Forint
  { code: 'IDR', minorUnit: 2 }, // Rupiah
  { code: 'ILS', minorUnit: 2 }, // New Israeli Sheqel
  { code: 'INR', minorUnit: 2 }, // Indian Rupee
  { code: 'IQD', minorUnit: 3 }, // Iraqi Dinar
  { code: 'IRR', minorUnit: 2 }, // Iranian Rial
  { code: 'ISK', minorUnit: 0 }, // Iceland Krona
  { code: 'JMD', minorUnit: 2 }, // Jamaican Dollar
  { code: 'JOD', minorUnit: 3 }, // Jordanian Dinar
  { code: 'JPY', minorUnit: 0 }, // Yen
  { code: 'KES', minorUnit: 2 }, // Kenyan Shilling
  { code: 'KGS', minorUnit: 2 }, // Som
  { code: 'KHR', minorUnit: 2 }, // Riel
  { code: 'KMF', minorUnit: 0 }, // Comorian Franc
  { code: 'KPW', minorUnit: 2 }, // North Korean Won
  { code: 'KRW', minorUnit: 0 }, // Won
  { code: 'KWD', minorUnit: 3 }, // Kuwaiti Dinar
  { code: 'KYD', minorUnit: 2 }, // Cayman Islands Dollar
  { code: 'KZT', minorUnit: 2 }, // Tenge
  { code: 'LAK', minorUnit: 2 }, // Lao Kip
  { code: 'LBP', minorUnit: 2 }, // Lebanese Pound
  { code: 'LKR', minorUnit: 2 }, // Sri Lanka Rupee
  { code: 'LRD', minorUnit: 2 }, // Liberian Dollar
  { code: 'LSL', minorUnit: 2 }, // Loti
  { code: 'LYD', minorUnit: 3 }, // Libyan Dinar
  { code: 'MAD', minorUnit: 2 }, // Moroccan Dirham
  { code: 'MDL', minorUnit: 2 }, // Moldovan Leu
  { code: 'MGA', minorUnit: 2 }, // Malagasy Ariary
  { code: 'MKD', minorUnit: 2 }, // Denar
  { code: 'MMK', minorUnit: 2 }, // Kyat
  { code: 'MNT', minorUnit: 2 }, // Tugrik
  { code: 'MOP', minorUnit: 2 }, // Pataca
  { code: 'MRU', minorUnit: 2 }, // Ouguiya
  { code: 'MUR', minorUnit: 2 }, // Mauritius Rupee
  { code: 'MVR', minorUnit: 2 }, // Rufiyaa
  { code: 'MWK', minorUnit: 2 }, // Malawi Kwacha
  { code: 'MXN', minorUnit: 2 }, // Mexican Peso
  { code: 'MXV', minorUnit: 2 }, // Mexican Unidad de Inversion (UDI)
  { code: 'MYR', minorUnit: 2 }, // Malaysian Ringgit
  { code: 'MZN', minorUnit: 2 }, // Mozambique Metical
  { code: 'NAD', minorUnit: 2 }, // Namibia Dollar
  { code: 'NGN', minorUnit: 2 }, // Naira
  { code: 'NIO', minorUnit: 2 }, // Cordoba Oro
  { code: 'NOK', minorUnit: 2 }, // Norwegian Krone
  { code: 'NPR', minorUnit: 2 }, // Nepalese Rupee
  { code: 'NZD', minorUnit: 2 }, // New Zealand Dollar
  { code: 'OMR', minorUnit: 3 }, // Rial Omani
  { code: 'PAB', minorUnit: 2 }, // Balboa
  { code: 'PEN', minorUnit: 2 }, // Sol
  { code: 'PGK', minorUnit: 2 }, // Kina
  { code: 'PHP', minorUnit: 2 }, // Philippine Peso
  { code: 'PKR', minorUnit: 2 }, // Pakistan Rupee
  { code: 'PLN', minorUnit: 2 }, // Zloty
  { code: 'PYG', minorUnit: 0 }, // Guarani
  { code: 'QAR', minorUnit: 2 }, // Qatari Rial
  { code: 'RON', minorUnit: 2 }, // Romanian Leu
  { code: 'RSD', minorUnit: 2 }, // Serbian Dinar
  { code: 'RUB', minorUnit: 2 }, // Russian Ruble
  { code: 'RWF', minorUnit: 0 }, // Rwanda Franc
  { code: 'SAR', minorUnit: 2 }, // Saudi Riyal
  { code: 'SBD', minorUnit: 2 }, // Solomon Islands Dollar
  { code: 'SCR', minorUnit: 2 }, // Seychelles Rupee
  { code: 'SDG', minorUnit: 2 }, // Sudanese Pound
  { code: 'SEK', minorUnit: 2 }, // Swedish Krona
  { code: 'SGD', minorUnit: 2 }, // Singapore Dollar
  { code: 'SHP', minorUnit: 2 }, // Saint Helena Pound
  { code: 'SLE', minorUnit: 2 }, // Leone
  { code: 'SOS', minorUnit: 2 }, // Somali Shilling
  { code: 'SRD', minorUnit: 2 }, // Surinam Dollar
  { code: 'SSP', minorUnit: 2 }, // South Sudanese Pound
  { code: 'STN', minorUnit: 2 }, // Dobra
  { code: 'SVC', minorUnit: 2 }, // El Salvador Colon
  { code: 'SYP', minorUnit: 2 }, // Syrian Pound
  { code: 'SZL', minorUnit: 2 }, // Lilangeni
  { code: 'THB', minorUnit: 2 }, // Baht
  { code: 'TJS', minorUnit: 2 }, // Somoni
  { code: 'TMT', minorUnit: 2 }, // Turkmenistan New Manat
  { code: 'TND', minorUnit: 3 }, // Tunisian Dinar
  { code: 'TOP', minorUnit: 2 }, // Pa’anga
  { code: 'TRY', minorUnit: 2 }, // Turkish Lira
  { code: 'TTD', minorUnit: 2 }, // Trinidad and Tobago Dollar
  { code: 'TWD', minorUnit: 2 }, // New Taiwan Dollar
  { code: 'TZS', minorUnit: 2 }, // Tanzanian Shilling
  { code: 'UAH', minorUnit: 2 }, // Hryvnia
  { code: 'UGX', minorUnit: 0 }, // Uganda Shilling
  { code: 'USD', minorUnit: 2 }, // US Dollar
  { code: 'USN', minorUnit: 2 }, // US Dollar (Next day)
  { code: 'UYI', minorUnit: 0 }, // Uruguay Peso en Unidades Indexadas (UI)
  { code: 'UYU', minorUnit: 2 }, // Peso Uruguayo
  { code: 'UYW', minorUnit: 4 }, // Unidad Previsional
  { code: 'UZS', minorUnit: 2 }, // Uzbekistan Sum
  { code: 'VED', minorUnit: 2 }, // Bolívar Soberano
  { code: 'VES', minorUnit: 2 }, // Bolívar Soberano
  { code: 'VND', minorUnit: 0 }, // Dong
  { code: 'VUV', minorUnit: 0 }, // Vatu
  { code: 'WST', minorUnit: 2 }, // Tala
  { code: 'XAD', minorUnit: 2 }, // Arab Accounting Dinar
  { code: 'XAF', minorUnit: 0 }, // CFA Franc BEAC
  { code: 'XCD', minorUnit: 2 }, // East Caribbean Dollar
  { code: 'XCG', minorUnit: 2 }, // Caribbean Guilder
  { code: 'XOF', minorUnit: 0 }, // CFA Franc BCEAO
  { code: 'XPF', minorUnit: 0 }, // CFP Franc
  { code: 'YER', minorUnit: 2 }, // Yemeni Rial
  { code: 'ZAR', minorUnit: 2 }, // Rand
  { code: 'ZMW', minorUnit: 2 }, // Zambian Kwacha
  { code: 'ZWG', minorUnit: 2 }, // Zimbabwe Gold
]

/** 問い合わせ文字列の値を 1 つだけ取り出す。**同じ名前が複数付いていても、先頭だけを見る。** */
export const single = (value: string | readonly string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.[0]

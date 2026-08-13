import { createId } from '@paralleldrive/cuid2'
import type { InviteCodeGenerator } from '../../usecase/port/invite-code-generator'

/**
 * `InviteCodeGenerator` の実装（`docs/adr/0002-invite-code.md`）。
 *
 * **cuid2 の既定設定で生成した文字列。短縮設定は使わない。**
 * 文字種は英小文字と数字のみで先頭は必ず英字であり、URL エスケープが不要なため
 * 共有リンクにそのまま埋め込める。
 *
 * 乱数由来で並びに規則性がないため、発行済みのコードから他のグループのコードを推測できない。
 * 参加コードは知っていれば参加できる鍵そのものであり、この性質が要る。
 */
export const cuid2InviteCodeGenerator: InviteCodeGenerator = {
  next: () => createId(),
}

/** 参加コードを生成するポート（`docs/adr/0002-invite-code.md`）。衝突したら呼び出し側が生成し直す。 */
export type InviteCodeGenerator = {
  next(): string
}

/**
 * 現在時刻を得るポート（`docs/adr/0008-layer-internals.md`「識別子の生成」）。
 *
 * 時刻の取得はランタイムへの依存であり、ドメイン層は依存を持たない（`docs/adr/0004`）。
 * 登録日時（`recordedAt`）はここから受け取る。**編集では取り直さない**
 * （`docs/domain/record.md`「記録の並び」）。
 */
export type Clock = {
  now(): Date
}

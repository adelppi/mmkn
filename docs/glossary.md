# 用語集 — 日本語とコード上の名前の対応

**この文書は索引であり、定義は持たない。** 各用語の意味は「一次情報」列の文書を正とする（`RULES.md` §7）。ここに意味を書き写さない。

目的は 1 つ。**同じ概念がコード上で複数の名前を持つ状態を防ぐこと。** `docs/` は日本語で書かれ、コードは英語で書かれるため、対応を決めておかないと `balance` / `diff` / `netAmount` が同じものを指す状態になる。

新しい概念を `domain/` に足したら、ここにも 1 行足す。

## グループとメンバー

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| ユーザー | `User` | `domain/group.md` |
| ユーザーの名前 | `name` | `domain/group.md` |
| グループ | `Group` | `domain/group.md` |
| メンバー | `Member` | `domain/group.md` |
| 表示名 | `displayName` | `domain/group.md` |
| 既定通貨 | `defaultCurrency` | `domain/group.md` |
| 参加コード | `inviteCode` | `domain/group.md`（形式は `adr/0002`） |
| 外部アカウント | `externalAccount` | `domain/group.md` |
| サービスの種別 | `service` | `domain/group.md`（ポートの形は `adr/0008`） |
| 場 | `place` | `domain/group.md` |
| 場と Group の対応 | `placeMapping` | `domain/group.md` |

## 記録

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| 記録（支払いと送金の総称） | `record` | `domain/record.md` |
| 支払い | `Payment` | `domain/record.md` |
| 送金 | `Transfer` | `domain/record.md` |
| 支払者 | `payer` | `domain/record.md` |
| 負担者 | `bearers` | `domain/record.md` |
| 負担額 | `share` | `domain/record.md` |
| 送り手 | `sender` | `domain/record.md` |
| 受け手 | `recipient` | `domain/record.md` |
| 内容 | `description` | `domain/record.md` |
| 発生日 | `occurredOn` | `domain/record.md` |
| 登録者 | `recordedBy` | `domain/record.md` |

## 金額

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| 金額 | `amount` | `domain/money.md` |
| 通貨 | `currency` | `domain/money.md` |
| 最小単位 | `minorUnit` | `domain/money.md` |

## 差額と清算

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| 差額 | `balance` | `domain/settlement.md` |
| 清算案 | `settlement` | `domain/settlement.md` |
| 清算案の送金 | `settlementTransfer` | `domain/settlement.md` |

## 実装だけに現れるもの

ドメインの語彙ではないが、名前がぶれると同じ問題が起きるもの。

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| 版（楽観ロック） | `version` | `adr/0005` |
| 合成ルート | `wire()` | `adr/0008` |
| ビューモデル | `<名前>View` | `adr/0009` |

## 名前の付け方

- **識別子は branded type にする**（`src/domain/id.ts`）。`GroupId` と `MemberId` を取り違えられない状態を型で作る（`adr/0008`）
- **集約の名前がそのままリポジトリの名前になる。** `Group` → `GroupRepository`（`adr/0008`）
- **`docs/domain/*.md` のファイル名と `src/domain/` のディレクトリ名を一致させる**（`adr/0004`）
- **紛らわしい対を混ぜない。** 特に次の 3 組は、ドメイン文書が明示的に「別のもの」と書いている
  - `payer`（支払者）と `recordedBy`（登録者）… `domain/record.md`
  - `Member`（グループ内の立場）と `User`（人そのもの）… `domain/group.md`
  - `settlementTransfer`（清算案が示す送金）と `Transfer`（記録された送金）… `domain/settlement.md`

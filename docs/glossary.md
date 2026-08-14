# 用語集 — 日本語とコード上の名前の対応

**この文書は索引であり、定義は持たない。** 各用語の意味は「一次情報」列の文書を正とする（`RULES.md` §7）。ここに意味を書き写さない。

**個別のステータス印は付けない**（対応表そのものは決定ではなく、一次情報の側が印を持つため）。一次情報の記述が覆ったら、ここも同じ PR で直す。

目的は 1 つ。**同じ概念がコード上で複数の名前を持つ状態を防ぐこと。** `docs/` は日本語で書かれ、コードは英語で書かれるため、対応を決めておかないと `balance` / `diff` / `netAmount` が同じものを指す状態になる。

新しい概念を `domain/` に足したら、ここにも 1 行足す。

## グループとメンバー

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| ユーザー | `User` | `domain/group.md` |
| ユーザーの名前 | `name` | `domain/group.md` |
| ログイン識別子 | `loginIdentifier` | `domain/group.md`（認証基盤の user の識別子としたのは `adr/0012`） |
| ログイン手段 | `loginMethod` | `domain/group.md`（使える外部サービスは `adr/0012`） |
| グループ | `Group` | `domain/group.md` |
| メンバー | `Member` | `domain/group.md` |
| 表示名 | `displayName` | `domain/group.md` |
| 既定通貨 | `defaultCurrency` | `domain/group.md` |
| 参加コード | `inviteCode` | `domain/group.md`（形式は `adr/0002`） |
| 外部アカウント | `ExternalAccount` | `domain/group.md` |
| サービスの種別 | `service` | `domain/group.md`（ポートの形は `adr/0008`） |
| 場 | `place` | `domain/group.md` |
| 場と Group の対応 | `placeMapping` | `domain/group.md` |
| 操作する User | `actor` | `domain/group.md`「前提条件を満たさなかったとき」 |
| 前提条件を満たさなかった理由 | `GroupAccessDenied` | `domain/group.md`「前提条件を満たさなかったとき」 |

## 記録

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| 記録（支払いと送金の総称） | `record` | `domain/record.md` |
| 支払いと送金をまとめた型 | `AnyRecord` | `domain/record.md`（`Record` が言語組み込みの型と衝突するため） |
| 支払い | `Payment` | `domain/record.md` |
| 送金 | `Transfer` | `domain/record.md` |
| 支払者 | `payer` | `domain/record.md` |
| 負担者 | `bearers` | `domain/record.md` |
| 負担額 | `share` | `domain/record.md` |
| 送り手 | `sender` | `domain/record.md` |
| 受け手 | `recipient` | `domain/record.md` |
| 内容 | `description` | `domain/record.md` |
| 発生日 | `occurredOn` | `domain/record.md` |
| 日付（時刻もタイムゾーンも持たない） | `PlainDate` | `domain/record.md`「発生日」 |
| 登録日時 | `recordedAt` | `domain/record.md` |
| 登録者 | `recordedBy` | `domain/record.md` |
| 配分順序 | `memberOrder` | `domain/record.md`「負担額の配分」 |

## 金額

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| 金額 | `amount` | `domain/money.md` |
| 金額と通貨の組 | `Money` | `domain/money.md`「金額の表し方」 |
| 通貨 | `currency` | `domain/money.md` |
| 最小単位 | `minorUnit` | `domain/money.md` |
| 通貨表（通貨と最小単位の対応） | `currencyTable` | `domain/money.md`（持ち方は `adr/0016`） |
| 廃止された通貨に立てる印 | `withdrawn` | `domain/money.md`「廃止された通貨」 |
| 入力候補に出す通貨 | `selectableCurrencies` | `domain/money.md`「廃止された通貨」 |

## 収支と清算

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| 収支 | `balance` | `domain/settlement.md` |
| 通貨ごとの収支 | `CurrencyBalances` | `domain/settlement.md`「収支」 |
| 清算案 | `settlement` | `domain/settlement.md` |
| 清算案の送金 | `settlementTransfer` | `domain/settlement.md` |

## 実装だけに現れるもの

ドメインの語彙ではないが、名前がぶれると同じ問題が起きるもの。

| 日本語 | コード上の名前 | 一次情報 |
|---|---|---|
| 版（楽観ロック） | `version` | `adr/0005` |
| 記録と版の組 | `Versioned` | `adr/0005`（取得側は記録と版を組で返す） |
| 見ていた版で更新・削除が通らなかった失敗 | `versionConflict` | `domain/record.md`「同じ記録に同時に手が入ったとき」（実現方式は `adr/0005`） |
| ユースケースの結果 | `Result` | `adr/0008` |
| 合成ルート | `wire()` | `adr/0008` |
| ビューモデル | `<名前>View` | `adr/0009` |
| 済んだことの知らせ（トースト） | `Notice` | `adr/0009`「トースト」 |
| 遷移をまたいで知らせを運ぶ印 | `NoticeTag` | `adr/0009`「トースト」 |
| 相関 ID（ログ） | `correlationId` | `adr/0014` |

## 名前の付け方

- **識別子は branded type にする**（`src/domain/id.ts`）。`GroupId` と `MemberId` を取り違えられない状態を型で作る（`adr/0008`）
- **集約の名前がそのままリポジトリの名前になる。** `Group` → `GroupRepository`（`adr/0008`）
- **`docs/domain/*.md` のファイル名と `src/domain/` のディレクトリ名を一致させる**（`adr/0004`）
- **紛らわしい対を混ぜない。** 特に次の 5 組は、ドメイン文書が明示的に「別のもの」と書いている
  - `payer`（支払者）と `recordedBy`（登録者）… `domain/record.md`
  - `Member`（グループ内の立場）と `User`（人そのもの）… `domain/group.md`
  - `settlementTransfer`（清算案が示す送金）と `Transfer`（記録された送金）… `domain/settlement.md`
  - `occurredOn`（発生日・時刻を持たない）と `recordedAt`（登録日時・時点）… `domain/record.md`
  - `name`（User の名前）と `displayName`（Group 内の表示名）と `loginIdentifier`（ログイン識別子）… `domain/group.md`
  - `loginIdentifier`（1 User に 1 つ。ログインしたときに行き着く先）と `loginMethod`（1 User に 1 つ以上。ログインの入口となる外部アカウント）… `domain/group.md`「User と外部アカウント」。**片方は増えず、もう片方は増える**

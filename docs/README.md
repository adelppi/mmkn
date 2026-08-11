# mmkn ドキュメント

グループ内で発生したお金の動きを記録し、その記録から「今、誰が誰にいくら送ればよいか」を導出するシステム。

## このドキュメントの使い方

- **要求・コンセプトを掴みたい** → `overview.md`
- **何を作るか（機能の一覧）** → `features.md`
- **ドメインのルールを正確に知りたい** → `domain/`
- **なぜその技術にしたか（意思決定の記録）** → `adr/`
- **まだ決まっていないこと** → `open-questions.md`
- **どこに何を書けばいいか** → `RULES.md`

## 構成

<!-- ファイルを追加・削除したらこのツリーも更新する。/check-docs が実ファイルとの一致を検査する。 -->

```
docs/
├── README.md              … 本ファイル（目次・一次情報の所在）
├── RULES.md               … 配置ルール（どこに何を書くか）※書く前に読む
├── overview.md            … ビジョン / ターゲット / 提供価値 / コアループ
├── features.md            … 機能一覧（持つ／持たない）
├── open-questions.md      … 未確定論点（[保留] の集約）
├── domain/                … 業務ルール（機能ごとに 1 ファイル）
│   ├── _template.md       … ドメイン文書の雛形
│   ├── group.md           … グループとメンバー
│   ├── money.md           … 金額と通貨
│   ├── record.md          … 記録（支払いと送金）
│   └── settlement.md      … 差額と清算案
└── adr/                   … 技術的意思決定の記録
    ├── _template.md       … ADR の雛形
    ├── 0001-settlement-greedy.md … 清算案を貪欲法で求める
    ├── 0002-invite-code.md       … 参加コードを cuid2 で生成する
    ├── 0003-tech-stack.md        … 技術スタック（Next.js / Supabase / Discord HTTP Interactions）
    ├── 0004-layers-and-dependencies.md      … 層の分け方と依存方向の機械検査
    ├── 0005-data-access-and-authorization.md … データアクセス経路と認可の置き場所
    ├── 0006-discord-http-interactions.md    … Discord クライアントの接続方式と実装要件
    ├── 0007-external-account-linking.md     … 外部アカウントの連携方式
    ├── 0008-layer-internals.md              … 各層の内部構造と実装の型
    └── 0009-web-ui.md                       … Web の UI 構成と UI ライブラリ
```

<!-- 0003 がスタック全体の親。0004〜0009 は 0003 を前提とする個別決定。0008 は 0004 の内側を、0009 は 0008 を前提に Web の画面を埋める。0001・0002 はスタックに依存しない決定。 -->

必要になったら文書を足してよい（用語集・データモデル・非機能要件など）。**足したらこのツリーと下の表を更新する。**

## 3 層の責務分離

| 層 | 問い | 文書 | 判定 |
|---|---|---|---|
| WHAT | 何を作るか | `features.md` | 作る／作らないの話 |
| 振る舞い | どう動くか | `domain/` | 技術を入れ替えても**変わらない**話 |
| 実現 | どう作るか | `adr/` | 技術を入れ替えると**変わる**話 |

**具体的な禁止事項・NG 例・グレーゾーンの判定は `RULES.md` を正とする。** ここには再掲しない。

## 一次情報の所在

ある事実の「正」は 1 文書だけ。他の文書は再掲せずリンクする。**事実を確定させたらこの表に 1 行足す。**

| 事実 | 一次情報（正） |
|---|---|
| 持つ機能／持たない機能とその理由 | `features.md` |
| プロダクトのビジョン・コアループ | `overview.md` |
| ターゲット、プラットフォーム・対応地域・収益・開発体制 | `overview.md` |
| 成功の見方（定量指標を持たないこと） | `overview.md` |
| User / Group / Member の定義、参加コード、表示名 | `domain/group.md` |
| グループ作成・参加・表示名変更・設定変更の振る舞い | `domain/group.md` |
| User と外部アカウントの関係、連携・解除の振る舞い、未連携時に起きること | `domain/group.md` |
| 「場」の定義、場と Group の対応づけ・解除、未対応の場から操作したときに起きること | `domain/group.md` |
| 金額の表し方（整数 + 通貨）、通貨をまたがないこと | `domain/money.md` |
| 扱う通貨の範囲（ISO 4217）と金額の上限 | `domain/money.md` |
| Payment / Transfer の定義と属性 | `domain/record.md` |
| 負担額の均等配分と端数の寄せ方 | `domain/record.md` |
| 発生日の扱い（未来の日付を許すこと） | `domain/record.md` |
| 記録の並び順 | `domain/record.md` |
| 登録者の扱い（権限に使わないこと） | `domain/record.md` |
| 記録の編集・削除、削除履歴を持たないこと | `domain/record.md` |
| 同じ記録に同時に手が入ったときに起きること | `domain/record.md` |
| 差額の導出ルールと性質 | `domain/settlement.md` |
| 清算案の導出ルール、保存しないこと | `domain/settlement.md` |
| 清算案の送金を記録する振る舞い（金額を登録時点で導出し直すこと） | `domain/settlement.md` |
| 清算案の送金の組み合わせの求め方 | `adr/0001-settlement-greedy.md` |
| 参加コードの形式と生成方法 | `adr/0002-invite-code.md` |
| 技術スタック、サーバーレスの制約、環境変数の区分 | `adr/0003-tech-stack.md` |
| 層の責務と依存の向き、ディレクトリ構造、依存方向の検査、テストの組み立て方 | `adr/0004-layers-and-dependencies.md` |
| データアクセス経路、ORM、マイグレーション運用、認可の置き場所と RLS の扱い、競合対策の実現方式とバージョンの置き場 | `adr/0005-data-access-and-authorization.md` |
| Discord の接続方式・3 秒制限の扱い・場の対応・表示・可視性の宣言単位・コンポーネント・上限と運用 | `adr/0006-discord-http-interactions.md` |
| 外部アカウント連携の実現方式とスコープ・トークンの扱い | `adr/0007-external-account-linking.md` |
| 各層の内部構造、Controller と Presenter の役割、ユースケースの入出力と失敗の表し方、永続化の単位、識別子の生成、合成ルート、層ごとの import 規則 | `adr/0008-layer-internals.md` |
| Web の画面構成（Container/Presentational）、ビューモデルの制約、UI ライブラリ、フォームの実装方式、クライアント側の入力検査の範囲 | `adr/0009-web-ui.md` |
| まだ決まっていないこと | `open-questions.md` |

## ステータス印

`[確定]` 合意済み ／ `[提案]` 叩き台・要確認 ／ `[保留]` 未確定（`open-questions.md` へ登録）

印のない断定的な記述は「まだ誰も合意していない」と見なす。詳細は `RULES.md`。

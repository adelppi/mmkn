# AI駆動開発テンプレート

要件定義から実装・PR まで、Claude Code と一緒に進めるためのプロジェクト雛形。

**技術スタックには依存しない。** Web でもモバイルでも CLI でも使える。

> **この文書について**
> mmkn はこのテンプレートから作られている。テンプレート本来の手順では、初期化時にこの説明書を削除する（`rm README.md`）。
> mmkn では**進め方をいつでも参照できるように残し**、`README.md` → `TEMPLATE.md` にリネームしてある。ルートの `README.md` は mmkn 自身の説明。
>
> 以下の記述に出てくる `README.md` は、このファイル（`TEMPLATE.md`）のことを指す。

## 考え方

要件定義に専用コマンドは用意しない。**普通に会話して決め、`/sync-docs` で docs に落とす。**

そのぶん「**どこに何を書くか**」を厳格に決めてある。文書の役割が混ざると、人も AI も「どこを読めば正しいか」が分からなくなるため。

- `domain/` に**インフラ・ライブラリ・DB 構造を持ち込まない**
- `adr/` に**ドメインのルールを定義しない**（参照はする）

ルールの本体は `docs/RULES.md`。`/sync-docs` は書く前に、`/check-docs` は検査時に、必ずこれを読む。

## 何が入っているか

| | 中身 |
|---|---|
| `docs/` | 要件・仕様・設計ドキュメントの骨格（中身は空。プレースホルダのみ） |
| `docs/RULES.md` | **配置ルール。このテンプレートの中核** |
| `.claude/skills/` | スラッシュコマンド 4 本 |
| `.github/` | Issue テンプレート（feature / bug / design）と PR テンプレート |
| `CLAUDE.md` | Claude Code に読ませるプロジェクト規約 |
| `{{プロダクト名}}.code-workspace` | VS Code ワークスペース（root / docs の 2 ペイン構成） |

## スラッシュコマンド

| コマンド | 用途 |
|---|---|
| `/sync-docs` | 会話で決まったことを docs/ に反映する。配置を判定し、必要なら ADR も作る |
| `/check-docs` | docs/ の整合性を検査する。配置ルール違反を最優先で検出する |
| `/create-issue <一文>` | 質問で詳細を掘り下げて GitHub Issue を起票する |
| `/implement-issue <番号>` | ブランチ作成 → 実装 → テスト → PR 作成 |

## 使い始め方

### 1. コピーして初期化

```bash
cp -R /path/to/ai-driven-dev-template /path/to/my-project
cd /path/to/my-project
rm README.md          # このファイル（テンプレートの説明）は不要
git init
git remote add origin git@github.com:<owner>/<repo>.git
```

GitHub リポジトリ名はどのファイルにもハードコードされていない。スキルが `git remote get-url origin` から解決する。

### 2. 会話を始める

```
作りたいのは〜〜なアプリです。要件を詰めたいので質問してください。
```

一区切りついたら `/sync-docs`。以降も同じ繰り返し。

### 3. プレースホルダ

`{{プロダクト名}}` `{{一行説明}}` は最初の `/sync-docs` で一括置換され、`{{プロダクト名}}.code-workspace` もリネームされる。
`docs/domain/_template.md` と `docs/adr/_template.md` は**雛形なので置換しない**（コピー元として使う）。

## VS Code ワークスペース

`{{プロダクト名}}.code-workspace` を開くと、`root` と `docs` が別ペインに分かれる。docs を見ながらコードを触るための構成。

コードのディレクトリを作ったら `folders` に足す（ファイル内にコメントで例を書いてある）。`settings` は Markdown 執筆向けの最小限（折り返し・行末スペースを消さない・検索除外）、`extensions` は mermaid プレビューのみ。スタック固有の設定は、決まってから足す。

## 全体の流れ

```
  会話で決める  ──→  /sync-docs  ──→  docs/ に反映
       ↑                                   │
       │                                   ↓
       └──────────────────────  /check-docs で整合を検査

  docs が固まったら
       ↓
  /create-issue  ──→  /implement-issue  ──→  PR
```

書き溜まる順序の目安は `overview.md` → `features.md` → `domain/*.md` → `adr/*.md` → Issue。

## docs の構成

```
docs/
├── README.md          目次・一次情報の所在
├── RULES.md           配置ルール（書く前に読む）
├── overview.md        何を・誰に・なぜ作るか
├── features.md        何を作る／作らないか
├── open-questions.md  未確定論点
├── domain/            どう動くか（技術非依存）
└── adr/               どう作るか（技術的決定）
```

用語集・データモデル・非機能要件などは、必要になったら足す。足したら `docs/README.md` の構成ツリーを更新する。

## 前提

- 日本語で書く（Issue・PR・コミット・docs すべて）。
- GitHub 操作は GitHub MCP ツール、または `gh` CLI。
- 1 Issue = 1 ブランチ = 1 PR、squash merge。

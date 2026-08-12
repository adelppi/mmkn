# ADR-0009: Web の UI を Container/Presentational で分け、shadcn/ui を使う

- ステータス: 採用 [確定]
- 関連: `docs/overview.md`, `docs/features.md`, `docs/domain/record.md`, `adr/0003-tech-stack.md`, `adr/0004-layers-and-dependencies.md`, `adr/0005-data-access-and-authorization.md`, `adr/0008-layer-internals.md`, `adr/0010-testing.md`

## コンテキスト

`overview.md` はスマホでの利用を前提とした Web アプリを提供形態の 1 つとして確定させている。その画面をどう構成するかをここで決める。

前提は 3 つある。

- Web の操作経路は Server Actions（`adr/0003`）
- ユースケースは戻り値で結果を返し、失敗は `Result` 型で表す（`adr/0008`）
- 表示用の変換は `adapter/web/presenter` が持ち、そこはフレームワークに依存しない（`adr/0004`・`adr/0008`）

App Router では、データ取得を行う Server Component が `async` になるためテストで扱いにくい。表示の検証手段を確保するには、データ取得と描画を分ける必要がある。

なお **この決定が波及するのは Web 側だけである。** Discord 側の表示は `adapter/discord/presenter` に閉じており（`adr/0006`）、UI の構成を後から変えても影響しない。`adr/0004` の層の分離により、比較的安く差し替えられる種類の決定になっている。

## 決定

### Container/Presentational

**画面を Container と Presentational に分ける。**

| | 実体 | 責務 |
|---|---|---|
| Container | `async` な Server Component | 現在の User を解決し、ユースケースを呼び、ビューモデルを得る |
| Presentational | props だけを受け取るコンポーネント | ビューモデルを描画する。データ取得を行わない |

**`adapter/web/presenter` の出力型が、そのまま Presentational の props 型になる。** ビューモデルの定義がフレームワークの外にあるため、Presentational はそれを受け取るだけの存在になる。

**読み取りもユースケースを通す。** Container からリポジトリを直接呼ばない。`adr/0005` が「ユースケースを通さないデータアクセス経路を作った瞬間に認可が消える」と定めており、表示のための取得もその例外ではない。

**ビューモデルはシリアライズ可能な素の値だけで構成する。** 入力を含む Presentational はクライアント側で動くため、`Map` やクラスのインスタンスは境界を越えられない。整形済みの文字列・数値・配列・プレーンなオブジェクトまで落とすのは Presenter の責務とする。

### 失敗の描画

**ユースケースの失敗は、Presenter がビューモデルのタグとして表現する。** Container で成功と失敗に分岐させない。

```ts
export type SettlementView =
  | { kind: 'ok'; rows: SettlementRow[] }
  | { kind: 'empty' }
  | { kind: 'notMember' }
```

Container が 1 行で済み、失敗時の表示も Presentational だけで確認できる。Discord 側で案内を組み立てる Presenter（`adr/0006`）と同じ位置に収まるため、2 つの提供形態で失敗の扱いが対称になる。

### Container の粒度

**データ取得の単位で Container を分け、`page.tsx` では境界ごとに並べる。**

```tsx
<Suspense fallback={…}><RecordListContainer groupId={id} /></Suspense>
<Suspense fallback={…}><BalanceContainer   groupId={id} /></Suspense>
<Suspense fallback={…}><SettlementContainer groupId={id} /></Suspense>
```

収支と清算案はどちらも記録の全件を読むため（`domain/settlement.md`）、この分け方では同じ取得が複数回走る。**重複はリクエスト内で完結する仕組みで束ねる。** リクエストをまたがないため、`adr/0003` の「プロセス内メモリに状態を保持しない」には触れない。線引きは `adr/0003` を正とする。

### 配置と命名

**画面の隣に置く。ファイル名を規約とし、検査に使う。**

```
app/(web)/groups/[id]/
├─ page.tsx
├─ actions.ts
└─ _containers/<name>/
    ├─ container.tsx
    ├─ presentation.tsx
    └─ presentation.stories.tsx
```

`presentation.stories.tsx` の位置づけ（Storybook を持つこと、それをテストと見なすか）は `adr/0010-testing.md` を正とする。

`adr/0008` の検査ルールに、`app/` 配下のパス単位のルールを加える。

| パス | import してよい |
|---|---|
| `app/**/container.tsx` | `app/_lib/*`・`src/adapter/web/**`・同ディレクトリの `presentation.tsx` |
| `app/**/presentation.tsx` | React・`src/adapter/web/presenter/**` の型・`app/_ui/**` |
| `app/_ui/**` | React と UI プリミティブのみ（`app/_lib/*`・`src/usecase/**`・`src/infra/**`・`src/adapter/**` を禁止） |

コンポーネントを画面の隣に置いても、この規約により「Presentational がユースケースを直接呼ばない」を目視ではなく検査で守れる。

### UI ライブラリ

**shadcn/ui を使う。前提として Tailwind CSS と Radix のプリミティブが入る。**

コピーした部品は **`app/_ui/`** に置き、生成の設定でその位置を指定する。`src/` に置かないのは、`adr/0004` がトップレベルを層で切ると定めており、UI 部品は層ではないため。UI はアプリ層の責務であり `app/` の下に収まる。

選定の理由は 3 つ。

1. **部品が props で完結するため、Container/Presentational とそのまま噛み合う。** 多くがクライアント側で動く部品になるが、それは Presentational 側の話で、Container は Server Component のまま残る
2. **コードを自分のリポジトリに持つため、バージョン追従の作業が発生しない。** 使う部品だけが入る
3. **波及が Web 側に閉じる。** Discord 側の表示に影響しないため、選定を重く扱わなくてよい

### フォーム

**Server Action の戻り値をフォームの状態とし、フォーム状態管理のライブラリを入れない。** shadcn/ui の入力部品は使うが、`react-hook-form` を前提とするラッパは使わない。

Controller のシグネチャを、直前の状態と入力を受けて次の状態を返す形に揃える。

```ts
// src/adapter/web/controller/payment.ts
export const addPayment = (deps: Deps) =>
  async (_prev: AddPaymentView, fd: FormData): Promise<AddPaymentView> => {
    const input = parsePaymentForm(fd)
    if (!input.ok) return invalidView(input.error)
    return toAddPaymentView(await deps.registerPayment(input.value))
  }
```

初期状態も Presenter が持つ。これによりフォームの状態の正が「サーバーが返したビューモデル」1 つだけになる。

### クライアント側の入力検査

**クライアントで行う検査は、ブラウザ標準の入力属性（必須・型・上限・下限）にとどめる。業務ルールを書かない。**

負担者の人数や、支払者と負担者の関係のような条件を書くと、`domain/record.md` と同じルールが 2 か所に存在することになる（`RULES.md` §7）。失敗はビューモデルとしてサーバーから戻るため、伝える手段は既にある。

**入力属性に入れる値は `domain/` を正とし、この ADR にも実装にも数値を書かない。** 金額の上限は `domain/money.md`、グループ名・表示名の長さは `domain/group.md`、内容の長さは `domain/record.md` にある。ドメイン層が公開する定数をそのまま `maxlength` に渡す形にし、画面側で数値を打たない。

## 結果

- 良い点：
  - 表示を props だけで検証できる。失敗時の表示も同じ手段で確認できる
  - ビューモデルの定義がフレームワークの外にあるため、UI ライブラリを替えても `adapter/web/presenter` が残る
  - 重い導出（清算案）を後から届ける形にできる
  - 検証ルールの正が `domain/` の 1 か所にしか存在しない状態を保てる
- 留意点：
  - **Container を分けた分だけ同じ取得が重複する。** 束ねる仕組みを入れ忘れると、記録の全件取得が画面ごとに複数回走る
  - ビューモデルにシリアライズの制約が付く。Presenter が整形済みの値まで落とす必要があり、ドメインの値をそのまま渡せない
  - 入力中のフィードバックはサーバーへの往復を待つ。スマホ前提（`overview.md`）で体感が問題になった場合は、ルールを二重化しない範囲で見直す
  - **部品のコードを自分で持つため、その保守は自分の責任になる。** 更新は自動では届かない

## 検討した代替案

- **Presentational もデータ取得を行う（分けない）**：ファイル数が減る。ただし `async` な Server Component が表示の検証手段を持てず、失敗時の見た目を確認する経路が無くなる。
- **Presentational を `src/ui/` に置く**：層と同じ階層に置けば検査ルールが素直に書ける。ただし `adr/0004` の「トップレベルを層で切る」に例外を作ることになり、画面の隣に部品が無い状態にもなる。ファイル名の規約で検査できるため、例外を作る利点が消えた。
- **Container をページ単位にする**：ファイル数が減り、同じ記録を複数回読む重複も起きない。ただし最も重い導出が終わるまで画面が出ない。
- **失敗を Container で分岐させる**：各 Presentational が成功形だけを知ればよくなる。ただし分岐がフレームワーク側に残り、失敗時の表示を props だけで確認できなくなる。
- **失敗を例外にしてフレームワークのエラー境界で受ける**：記述は最小。ただし `adr/0008` の「失敗を `Result` 型で表す」とアプリの端で矛盾し、失敗の種類ごとに表示を変えにくい。
- **Mantine**：完成度が高く、自分で持つコードが減る。ただしランタイム依存が増え、デザインの上書きが重い。
- **daisyUI**：Tailwind だけで済み最も軽い。ただしアクセシビリティを担うプリミティブが無く、負担者の複数選択のような部品を自前で書くことになる。
- **Radix を直接使い、部品を自前で書く**：shadcn/ui が生成するものを手で書くのと同じ結果になる。生成の仕組みを使わない理由が無い。
- **`react-hook-form` と、それを前提とするフォームのラッパを使う**：入力中の検査とフォーカス制御が丁寧になる。ただしクライアントにもフォームの状態が生まれ、サーバーから戻るビューモデルと正が 2 つ並ぶ。
- **クライアントでも業務ルールを検査する**：即座にフィードバックでき体験は最も良い。ただし `domain/` と同じルールが 2 か所に存在することになり、`adr/0005` が RLS を認可の正本にしなかったのと同じ理由で採らない。

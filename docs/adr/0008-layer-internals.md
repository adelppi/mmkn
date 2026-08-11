# ADR-0008: 各層の内部構造と実装の型を定める

- ステータス: 採用 [確定]
- 関連: `docs/domain/group.md`, `docs/domain/record.md`, `adr/0003-tech-stack.md`, `adr/0004-layers-and-dependencies.md`, `adr/0005-data-access-and-authorization.md`, `adr/0006-discord-http-interactions.md`, `adr/0007-external-account-linking.md`, `adr/0009-web-ui.md`

## コンテキスト

`adr/0004` は層の責務と依存の向きを決めたうえで、「構造と命名は実装時に定めてよい」として各層の内部を空けている。実装に入る前にそこを埋める。

埋めないまま着手すると、層はあっても中の書き方が場所ごとに違う状態になる。**依存の向きは機械検査で守れるが、層の内部の書き方は検査では守れない。** 個人開発であり、かつ AI に実装させることを前提とする以上（`CLAUDE.md`）、形を先に文書で固定しておく価値が大きい。

制約は `adr/0004` が既に定めたものをそのまま引き継ぐ。ドメインは依存を持たず、ポートは内側が定義し、アダプタはフレームワークに依存しない。

## 決定

### Controller と Presenter

アダプタ層は **Controller と Presenter の対**で構成する。向きが逆である。

| | 向き | 責務 |
|---|---|---|
| Controller | 外 → 内 | 外から届いた入力をユースケースの入力に変換し、ユースケースを呼ぶ |
| Presenter | 内 → 外 | ユースケースの出力を、そのクライアントの表示形式に変換する |

**Presenter はユースケースから呼ばれない。Controller が呼ぶ純関数とする。** 元のクリーンアーキテクチャでは Presenter は出力ポート経由でユースケースから呼ばれるが、後述のとおりユースケースは戻り値で結果を返すため、この形にはならない。名前は同じでも呼ばれ方が違う点に注意する。

Presenter がユースケースを呼ぶことはない。

### ユースケースの入出力

**ユースケースは戻り値で出力を返し、失敗は `Result` 型で表す。出力ポート（Presenter のインターフェース）を持たない。**

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

`Result` の定義は `src/domain/result.ts` に置く。ファイル 1 つとするのは、`src/domain/` の直下にディレクトリを増やすと `adr/0004` が定めた「`docs/domain/` の分割と 1 対 1」が崩れるため。

**失敗はユースケースごとのタグ付き union で表す。** アプリ全体で 1 つの union にはしない。そのユースケースで起こり得ない失敗を Presenter が扱わずに済み、分岐の漏れが型検査で落ちる。

**ユースケースは基底クラスを持たない。** 形は型エイリアスで揃え、依存は「`deps` を受けて関数を返す」規約で受け取る。

```ts
// src/usecase/usecase.ts
export type UseCase<I, O, E> = (input: I) => Promise<Result<O, E>>

// src/usecase/record/register-payment.ts
export const registerPayment =
  (deps: { payments: PaymentRepository; groups: GroupRepository; ids: IdGenerator; clock: Clock }) =>
  async (input: RegisterPaymentInput): Promise<Result<PaymentOutput, RegisterPaymentError>> => { /* … */ }
```

基底クラスを置かないのは、そこに入れるべき共通処理が残らないためである。認可はドメイン層（`adr/0005`）、トランザクションはリポジトリの実装（後述）、失敗の表示への変換は Presenter、ログ・計測は合成ルートで包む、と行き先がすべて別に決まっている。加えて、失敗の型をユースケースごとに変える以上、基底クラスで型を固定できない。

### 永続化の単位

**リポジトリは集約単位とし、トランザクションはその実装の中に閉じる。ユースケースはトランザクションの存在を知らない。**

集約は次の 3 つ。

| 集約 | 含むもの |
|---|---|
| Group | Group と、その Member |
| Payment | Payment と、その負担者 |
| Transfer | Transfer |

**Group の保存は、現在の Member 一覧で置き換える形にしない。追加された Member だけを書き込む。** 全体を置き換えると、2 人が同時に参加したときに片方が消える。`domain/group.md`「境界・例外ケース」はこの場合どちらも Member になると定めており、置き換え型の実装はそこで定められていない失敗を作り出す。重複した参加を弾く手段は `adr/0005` を正とする。

楽観ロックの版をドメインのエンティティに持たせないことも含め、競合の扱いは `adr/0005` を正とする。ポートは版を引数と戻り値で受け渡す形になる。

### 識別子の生成

**ID はユースケースが `IdGenerator` ポート経由で生成し、ドメインのファクトリは受け取るだけとする。**

```ts
const payment = Payment.create({ id: ids.paymentId(), /* … */ })
```

ドメインが生成器を直接呼ばないのは、`adr/0004` がドメインの依存先を「なし（言語標準のみ）」とし、機械検査の対象に**ランタイム API も含めている**ためである。ライブラリはもちろん `node:crypto` も使えない。

`domain/group.md`「実現方式」が参加コードについて既に同じ分離を採っている。ドメインが要求するのは「変わらないこと」と「決定的に並べられること」までで、作り方は要求していない。後者は `domain/record.md`「負担額の配分」の順序が実際に依存する。

**ファクトリメソッド（`Payment.create` など）は持つ。** そこがドメインの不変条件を守る唯一の場所であり、この決定はそれを外に出すものではない。

### ドメインの基底クラス

**ドメインのエンティティに基底クラスを置かない。**

- ID の生成を基底クラスに移しても、ライブラリへの依存が基底クラスに移るだけで消えない
- エンティティは DB の行からも組み立て直すため、基底クラスが構築時に ID を生成すると、生成しない経路を別に用意することになる
- 基底クラスが与えるのは ID の保持と同一性の比較だけであり、branded type（`src/domain/id.ts`）で同じ安全性が得られる

**集約がドメインイベントを溜めるようになった時点で、この決定を見直す。** 現時点では差額も清算案も保存せず（`features.md`）、削除履歴も持たないため、集約の外へ流すイベントが存在しない。

### 合成ルート

**依存の組み立ては `app/_lib/wire.ts` の `wire()` に置き、リクエストごとに呼ぶ。DI コンテナのライブラリは使わない。**

```ts
export function wire() {
  const groups = new DrizzleGroupRepository(pool)
  // …
  return { registerPayment: registerPayment({ payments, groups, ids, clock }) /* … */ }
}
```

`container` という名前を使わないのは、`adr/0009` の Container Component と衝突するため。

コネクションプールはモジュールスコープに置く。この線引きは `adr/0003` を正とする。

### Discord のペイロード型

**`discord-api-types` を使い、Interaction の型を自前で定義しない。** 型のみでランタイム依存を持たないため、アダプタ層のフレームワーク非依存を壊さない。

### ディレクトリ構造

`adr/0004` のツリーを、この ADR で定めた内訳まで展開したものを正とする。

```
app/
├─ _lib/
│   ├─ wire.ts                    … ポート実装を組み、ユースケースを返す（合成ルート）
│   └─ session.ts                 … infra/auth 経由で現在の UserId を得る
├─ _ui/                           … UI の部品（adr/0009）
├─ (web)/groups/[id]/
│   ├─ page.tsx
│   ├─ actions.ts                 … 'use server'。adapter/web/controller へ委譲
│   └─ _containers/<name>/        … adr/0009
├─ api/discord/route.ts           … 署名検証 → defer → 応答後に継続 → follow-up
└─ auth/callback/route.ts         … 外部アカウント連携のコールバック（adr/0007）

src/
├─ domain/                        … 依存なし
│   ├─ id.ts                      … branded ID と比較。負担額の配分の順序が使う
│   ├─ result.ts                  … Result 型
│   ├─ group/  money/  record/  settlement/    ← docs/domain/ と 1 対 1
├─ usecase/                       … domain のみ
│   ├─ usecase.ts                 … UseCase<I, O, E>
│   ├─ port/
│   │   ├─ group-repository.ts / payment-repository.ts / transfer-repository.ts
│   │   ├─ user-repository.ts
│   │   ├─ external-account-repository.ts   … (サービス種別, 外部 ID) → User
│   │   ├─ place-mapping-repository.ts      … (サービス種別, 場の識別子) → Group
│   │   └─ id-generator.ts / clock.ts / invite-code-generator.ts
│   └─ group/  record/  settlement/  account/
├─ adapter/
│   ├─ discord/
│   │   ├─ router.ts              … Interaction 種別で分岐
│   │   ├─ context.ts             … 外部 ID → User、場 → Group。解決できなければ案内を返す
│   │   ├─ command-definitions.ts … コマンド宣言（adr/0006）
│   │   ├─ controller/command/  controller/component/
│   │   └─ presenter/
│   ├─ web/
│   │   ├─ controller/
│   │   └─ presenter/
│   └─ shared/                    … 通貨の表示整形。最小単位は domain/money が正
└─ infra/
    ├─ db/                        … client / schema / migrations / mapper / repository
    ├─ auth/                      … client / session / external-account
    ├─ discord/                   … signature / client
    └─ system/                    … clock / id / invite-code
```

- `adapter/*/controller` と `adapter/*/presenter` が対になっていることを、ディレクトリ名で読み取れる状態にする
- `infra/db/mapper` を独立させ、ORM の推論型がリポジトリの外へ漏れない壁とする（`adr/0005`）
- 外部アカウントの参照は `infra/auth` に置く。認証基盤のスキーマ依存をそこだけに閉じるため（`adr/0007`）
- `adapter/shared` はクライアント固有でないものだけを置く。`adapter/` 直下がクライアントごとに増える場所であることは変わらない

### 依存方向の機械検査のルール

`adr/0004` が定めた検査を、この構造に対して次のとおり具体化する。

| パス | import してよい | 禁止モジュール |
|---|---|---|
| `src/domain/**` | `src/domain/**` | 外部パッケージすべて・`node:*` |
| `src/usecase/**` | `src/domain/**` | 外部パッケージすべて・`node:*` |
| `src/adapter/**` | `src/domain/**`・`src/usecase/**` | `next/*`・`node:*`・ORM・認証基盤の SDK（型のみのパッケージは除く） |
| `src/infra/**` | `src/domain/**`・`src/usecase/**`・`src/infra/**` | `next/*` |
| `app/**` | 制限なし | — |

加えて、`src/usecase/**` から `src/adapter/**`・`src/infra/**` への参照を**逆向きとして明示的に禁止する**。`app/` 配下のパス単位のルールは `adr/0009` を正とする。

## 結果

- 良い点：
  - Web と Discord の入口が同じ形（Controller が入力変換 → ユースケース → Presenter を繋ぐ）になり、2 つの提供形態の差分を目で追える
  - 失敗の分岐漏れが型検査で落ちるため、片方のクライアントだけ案内が抜ける事故が構造的に起きにくい
  - ユースケースが依存を引数で受けるため、テストで偽実装に差し替えるのに仕掛けが要らない（`adr/0004` のテスト方針がそのまま成立する）
  - トランザクションがリポジトリの実装に閉じるため、永続化を差し替えてもユースケースが変わらない
- 留意点：
  - **集約をまたぐ書き込みが必要になった時点で、この形は足りなくなる。** 現在の機能一覧（`features.md`）にはそのような操作が無いが、出てきたらこの ADR を見直す
  - `Result` を返す以上、呼び出し側は毎回分岐を書く。小さなユースケースでは冗長に見えるが、それが分岐漏れを型で落とす対価である
  - 層をまたぐ変換の記述量は増える。`adr/0004` が既に受け入れているコストと同種のもの
  - **`docs/domain/` の分割を変えたら `src/domain/` も追随させる**（`adr/0004`）。この ADR のツリーも同時に直す

## 検討した代替案

- **ユースケースが出力ポート（Presenter のインターフェース）を受け取る**：元のクリーンアーキテクチャの形であり、ユースケースが表示の完了まで責任を持てる。ただし TypeScript では戻り値で足りる場面が大半で、インターフェースの定義と実装の記述量だけが増える。呼び出し側で結果を使い回すこともできなくなる。
- **失敗を例外で表す**：記述は最も短い。ただしどの失敗が起こり得るかが型に出ないため、Presenter 側の網羅が目視頼みになる。`domain/record.md`「同じ記録に同時に手が入ったとき」のように、失敗が操作者へ確実に伝わることを要求している振る舞いがあり、取りこぼしの検出を型に任せたい。
- **失敗をアプリ全体で 1 つの union にする**：Presenter を 1 つにまとめられる。ただしどのユースケースでも起こり得ない失敗を型上扱うことになり、分岐の網羅が形式的なものになる。
- **UnitOfWork ポートをユースケースが持つ**：どんな組み合わせの書き込みにも対応できる。ただし「トランザクション」という永続化の概念がユースケース層の語彙に入る。現在の機能一覧では集約をまたぐ書き込みが必要ないため、先に払うコストとして合わない。
- **テーブル単位のリポジトリでトランザクションを持たない**：最も単純だが、途中で失敗すると Member のいない Group や負担者のいない Payment が残る。`domain/` が定義していない状態を作るため選べない。
- **ID を DB 側で生成する**：ポートが 1 つ減る。ただし保存前のエンティティが ID を持たない状態を型で表すことになり、集約内の参照（Payment とその負担者）を保存前に組めない。
- **ID をドメインが自分で生成する**：記述は最も短いが、`adr/0004` の「ドメインは依存を持たない」と機械検査に正面から衝突する。テストで毎回異なる ID を見ることにもなる。
- **ドメインとユースケースに基底クラスを置く**：形の統一が継承で表現でき、共通処理の置き場ができる。ただし ID 生成を基底クラスに移しても依存が移動するだけであること、DB からの復元経路が二重になること、ユースケース側は入れるべき共通処理が残らないことから、得るものが名前だけになる。ドメインイベントを持つようになれば再検討する。
- **DI コンテナのライブラリを導入する**：依存が増えたときの組み立てが宣言的になる。ただしユースケースが依存を引数で受ける形であれば `wire()` 1 つで足り、デコレータやメタデータの仕組みを個人開発で保守する理由がない。
- **Interaction の型を自前で定義する**：依存が 1 つ減る。ただし Discord の API の形を自分で追い続けることになり、`adr/0006` が列挙した上限や種別の変化に手で追随することになる。

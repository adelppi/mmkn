/**
 * 依存方向の機械検査。
 *
 * ルールの正は `docs/adr/0008-layer-internals.md`「依存方向の機械検査のルール」の表。
 * この設定はその表を機械が読める形に写したものであり、ここでルールを足したり緩めたりしない。
 *
 * | パス            | import してよい                                  | 禁止モジュール                                        |
 * |-----------------|--------------------------------------------------|-------------------------------------------------------|
 * | src/domain/**   | src/domain/**                                    | 外部パッケージすべて・node:*                          |
 * | src/usecase/**  | src/domain/**                                    | 外部パッケージすべて・node:*                          |
 * | src/adapter/**  | src/domain/**・src/usecase/**                    | next/*・node:*・ORM・認証基盤の SDK（型のみは除く）   |
 * | src/infra/**    | src/domain/**・src/usecase/**・src/infra/**      | next/*                                                |
 * | app/**          | 制限なし                                          | —                                                     |
 * | scripts/**      | 制限なし                                          | —                                                     |
 *
 * 読み替えを 2 つだけ行っている。どちらも表を緩めるものではない。
 *
 * 1. 同じ層の中での import は、どの層でも許す。表は「どの層を参照してよいか」を挙げたもので、
 *    層の中を分けられなくする意図ではない（`adr/0008` のツリー自体が各層の内部にディレクトリを持つ）。
 * 2. `src/domain/**`・`src/usecase/**` のテストファイルに限り、テストランナーの import を許す。
 *    テストファイルを検査の対象に含めるのは、層をまたぐ参照をテスト経由で逆流させないためであり
 *    （`adr/0010`）、ランナー自体を締め出すためではない。層どうしの規則はテストファイルにも等しくかかる。
 */

/** 外部パッケージと `node:*`。 */
const EXTERNAL = [
  'core',
  'npm',
  'npm-dev',
  'npm-optional',
  'npm-peer',
  'npm-bundled',
  'npm-no-pkg',
  'npm-unknown',
]

/** 未インストールのパッケージは解決前の名前で現れるため、両方の形に当てる。 */
const pkg = (names) => `^(node_modules/)?(${names.join('|')})(/|$)`

module.exports = {
  forbidden: [
    // ── 層ごとの import 許可 ────────────────────────────────────────────────
    {
      name: 'domain-imports',
      comment: 'ドメイン層が参照してよいのはドメイン層だけ',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^(src|app|scripts|tests)/', pathNot: '^src/domain/' },
    },
    {
      name: 'usecase-imports',
      comment: 'ユースケース層が参照してよいのはドメイン層だけ',
      severity: 'error',
      from: { path: '^src/usecase/' },
      to: { path: '^(src|app|scripts|tests)/', pathNot: '^src/(domain|usecase)/' },
    },
    {
      name: 'adapter-imports',
      comment: 'アダプタ層が参照してよいのはドメイン層とユースケース層だけ',
      severity: 'error',
      from: { path: '^src/adapter/' },
      to: { path: '^(src|app|scripts|tests)/', pathNot: '^src/(domain|usecase|adapter)/' },
    },
    {
      name: 'infra-imports',
      comment: 'インフラ層が参照してよいのはドメイン層とユースケース層とインフラ層だけ',
      severity: 'error',
      from: { path: '^src/infra/' },
      to: { path: '^(src|app|scripts|tests)/', pathNot: '^src/(domain|usecase|infra)/' },
    },
    // app/** と scripts/** は制限なし。参照の向きの規則を持たない（表の 5・6 行目）。

    // ── 逆向きの明示的な禁止（`adr/0008`）─────────────────────────────────
    {
      name: 'no-usecase-to-outer',
      comment: 'ユースケース層からアダプタ層・インフラ層へは向かわない（内側は外側を知らない）',
      severity: 'error',
      from: { path: '^src/usecase/' },
      to: { path: '^src/(adapter|infra)/' },
    },
    {
      name: 'no-src-to-scripts',
      comment: 'scripts/ はアプリが読み込まない道具。src/ から参照しない（adr/0008）',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^scripts/' },
    },

    // ── 層ごとの禁止モジュール ──────────────────────────────────────────────
    {
      name: 'inner-no-external',
      comment: 'ドメイン層・ユースケース層は言語標準のみ。ライブラリも node:* も使わない',
      severity: 'error',
      from: { path: '^src/(domain|usecase)/', pathNot: '\\.test\\.tsx?$' },
      to: { dependencyTypes: EXTERNAL },
    },
    {
      name: 'inner-test-no-external',
      comment: '同上。テストファイルも対象に含める（adr/0010）。例外はテストランナーだけ',
      severity: 'error',
      from: { path: '^src/(domain|usecase)/.*\\.test\\.tsx?$' },
      to: { dependencyTypes: EXTERNAL, pathNot: pkg(['vitest', '@vitest']) },
    },
    {
      name: 'adapter-no-runtime-api',
      comment: 'アダプタ層はランタイム API を使わない（adr/0004「フレームワーク非依存」）',
      severity: 'error',
      from: { path: '^src/adapter/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'adapter-no-framework-orm-auth',
      comment:
        'アダプタ層は next/*・ORM・認証基盤の SDK を使わない。型だけのパッケージは対象外（adr/0008）',
      severity: 'error',
      from: { path: '^src/adapter/' },
      to: { path: pkg(['next', 'drizzle-orm', 'drizzle-kit', '@supabase']) },
    },
    {
      name: 'infra-no-framework',
      comment: 'インフラ層は next/* を使わない。cookie などの読み取り手段はアプリ層から注入する（adr/0008）',
      severity: 'error',
      from: { path: '^src/infra/' },
      to: { path: pkg(['next']) },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // 型だけの import も検査の対象にする（そうしないと `import type` で層を越えられる）
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'types', 'default'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
    },
  },
}

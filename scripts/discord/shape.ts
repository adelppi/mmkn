/**
 * ソース上の宣言と、Discord に登録されている定義を突き合わせる形にそろえる。
 *
 * **登録済みの定義には、こちらが指定していない項目が付いて返る**（識別子・アプリケーション ID・
 * 各種の既定値）。素のまま比べると必ず差分が出るため、**宣言に書ける項目だけを取り出して比べる。**
 *
 * ここは純粋な変換だけを持つ（HTTP も環境変数も触らない）。差分の判定を手元で確かめられる
 * ようにするためで、テストは隣にある。
 */

/** 比べる対象の項目。**ここに無い違いは差分として扱わない。** */
type Canonical = {
  readonly name: string
  readonly description: string
  readonly type: number | undefined
  readonly required: boolean
  readonly autocomplete: boolean
  readonly options: readonly Canonical[]
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

const canonical = (value: unknown): Canonical => {
  const it = asRecord(value)
  const options = Array.isArray(it['options']) ? it['options'] : []

  return {
    name: asString(it['name']),
    description: asString(it['description']),
    type: typeof it['type'] === 'number' ? it['type'] : undefined,
    required: it['required'] === true,
    autocomplete: it['autocomplete'] === true,
    // **並びの違いは差分にしない。** Discord が返す順序はこちらが決めるものではない。
    options: options.map(canonical).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  }
}

const byName = (commands: readonly unknown[]): ReadonlyMap<string, Canonical> =>
  new Map(commands.map(canonical).map((command) => [command.name, command]))

/** 差分の 1 件。 */
export type CommandDifference = {
  readonly name: string
  readonly kind: 'missing' | 'stale' | 'unexpected'
}

/**
 * 宣言と登録済みの定義の差分。**空なら、登録されているものが宣言どおりである。**
 *
 * | 種類 | 意味 |
 * |---|---|
 * | `missing` | 宣言にあるが登録されていない。**デプロイしたのに反映されない状態**（`docs/adr/0006`） |
 * | `stale` | 登録されているが中身が古い |
 * | `unexpected` | 登録されているが宣言に無い |
 */
export const commandDifferences = (input: {
  readonly declared: readonly unknown[]
  readonly registered: readonly unknown[]
}): readonly CommandDifference[] => {
  const declared = byName(input.declared)
  const registered = byName(input.registered)

  const differences: CommandDifference[] = []

  for (const [name, command] of declared) {
    const found = registered.get(name)
    if (found === undefined) differences.push({ name, kind: 'missing' })
    else if (JSON.stringify(found) !== JSON.stringify(command)) {
      differences.push({ name, kind: 'stale' })
    }
  }

  for (const name of registered.keys()) {
    if (!declared.has(name)) differences.push({ name, kind: 'unexpected' })
  }

  return differences
}

const LABEL: Record<CommandDifference['kind'], string> = {
  missing: '登録されていない',
  stale: '登録されている定義が古い',
  unexpected: '宣言に無いものが登録されている',
}

export const describeDifferences = (differences: readonly CommandDifference[]): string =>
  differences.length === 0
    ? '差分なし（登録されているものは宣言どおり）'
    : differences.map((it) => `  ${it.name} … ${LABEL[it.kind]}`).join('\n')

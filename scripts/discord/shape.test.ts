import { describe, expect, it } from 'vitest'
import { applicationCommand } from '../../src/adapter/discord/definitions'
import { commandDifferences } from './shape'

/**
 * 定義との差分（`docs/adr/0006-discord-http-interactions.md`「コマンド登録の運用」）。
 *
 * **「デプロイしたのに反映されない」が構造的に起こり得る**ため、差分が実際に出ることを固定する。
 */

const declared = [applicationCommand()]

/** Discord が返す形。**こちらが指定していない項目が付いて返る。** */
const asRegistered = (command: unknown) => ({
  id: '123456789',
  application_id: '987654321',
  version: '1',
  default_member_permissions: null,
  description_localizations: null,
  name_localizations: null,
  nsfw: false,
  ...(command as object),
})

describe('宣言と登録済みの定義の差分', () => {
  it('同じなら差分は出ない（登録側にだけ付いてくる項目は無視する）', () => {
    expect(commandDifferences({ declared, registered: declared.map(asRegistered) })).toEqual([])
  })

  it('引数の並びが違うだけなら差分にしない', () => {
    const shuffled = declared.map((command) =>
      asRegistered({ ...command, options: [...(command.options ?? [])].reverse() }),
    )

    expect(commandDifferences({ declared, registered: shuffled })).toEqual([])
  })

  it('1 つも登録されていなければ、登録されていないとして出る', () => {
    expect(commandDifferences({ declared, registered: [] })).toEqual([
      { name: 'mmkn', kind: 'missing' },
    ])
  })

  it('説明が変わっていれば、古いとして出る', () => {
    const stale = declared.map((command) => asRegistered({ ...command, description: 'むかしの説明' }))

    expect(commandDifferences({ declared, registered: stale })).toEqual([
      { name: 'mmkn', kind: 'stale' },
    ])
  })

  it('サブコマンドが減っていれば、古いとして出る', () => {
    const stale = declared.map((command) =>
      asRegistered({ ...command, options: (command.options ?? []).slice(1) }),
    )

    expect(commandDifferences({ declared, registered: stale })).toEqual([
      { name: 'mmkn', kind: 'stale' },
    ])
  })

  it('オートコンプリートの指定が落ちていれば、古いとして出る', () => {
    const stale = declared.map((command) =>
      asRegistered({
        ...command,
        options: (command.options ?? []).map((option) =>
          'options' in option && option.options !== undefined
            ? { ...option, options: option.options.map((it) => ({ ...it, autocomplete: false })) }
            : option,
        ),
      }),
    )

    expect(commandDifferences({ declared, registered: stale })).toEqual([
      { name: 'mmkn', kind: 'stale' },
    ])
  })

  it('宣言に無いものが登録されていれば、それも出る', () => {
    const extra = [...declared.map(asRegistered), asRegistered({ name: 'むかしのコマンド' })]

    expect(commandDifferences({ declared, registered: extra })).toEqual([
      { name: 'むかしのコマンド', kind: 'unexpected' },
    ])
  })
})

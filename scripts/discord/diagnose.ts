import { applicationCommand, COMMAND_NAME } from '../../src/adapter/discord/definitions'
import { listRegisteredCommands } from '../../src/infra/discord/client'
import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from '../../src/infra/discord/signature'
import { application } from './application'
import { commandDifferences, describeDifferences } from './shape'

/**
 * 設定が正しいかを自力で確かめる（`docs/adr/0006-discord-http-interactions.md`
 * 「コマンド登録の運用」・`docs/operations.md`「診断」）。
 *
 * **テストは偽実装と手元の Postgres で回るため、本番の設定が正しいかは別に確かめる必要がある。**
 * 設定が正しいかを確かめる手段が無いと、原因不明の状態に陥る。
 *
 * ```
 * npm run discord:diagnose                          コマンドの登録状況と差分
 * npm run discord:diagnose -- https://mmkn.example  エンドポイントの疎通も見る
 * ```
 */

/** 診断 1 件の結果。**通らなかったものがあれば、終了コードで分かる。** */
type Check = { readonly name: string; readonly ok: boolean; readonly detail: string }

const report = (checks: readonly Check[]): number => {
  for (const check of checks) {
    console.log(`${check.ok ? '✔' : '✘'} ${check.name}`)
    console.log(check.detail.replace(/^/gm, '    '))
  }

  return checks.every((check) => check.ok) ? 0 : 1
}

const commandChecks = async (): Promise<readonly Check[]> => {
  const target = application()
  const declared = [applicationCommand()]
  const registered = await listRegisteredCommands(target)

  const names = registered
    .map((command) => (command as { name?: unknown }).name)
    .filter((name): name is string => typeof name === 'string')

  const differences = commandDifferences({ declared, registered })

  return [
    {
      name: 'コマンドの登録状況',
      ok: names.includes(COMMAND_NAME),
      detail: names.length === 0 ? '1 つも登録されていない' : names.map((it) => `/${it}`).join('\n'),
    },
    {
      name: '宣言との差分',
      ok: differences.length === 0,
      detail: describeDifferences(differences),
    },
  ]
}

/**
 * エンドポイントの疎通。
 *
 * **確かめられるのは「署名不正に 401 を返すこと」までである。** 正しい署名を作るには
 * Discord 側の秘密鍵が要り、こちらには無い。**正しい署名での往復は E2E が見る**
 * （`docs/adr/0010-testing.md`「E2E の範囲」。#25 で扱う）。
 *
 * それでも、この 1 つで次が分かる。
 *
 * - エンドポイントが到達可能であること（404 や 500 でないこと）
 * - **署名検証が入口にあること**（検証を外したら 401 以外が返る）
 */
const endpointCheck = async (origin: string): Promise<Check> => {
  const url = new URL('/api/discord', origin).toString()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SIGNATURE_HEADER]: '00'.repeat(64),
        [TIMESTAMP_HEADER]: String(Math.floor(Date.now() / 1000)),
      },
      body: JSON.stringify({ type: 1 }),
    })

    return {
      name: 'エンドポイントの疎通（署名不正に 401 を返すか）',
      ok: response.status === 401,
      detail: `${url} → ${response.status}`,
    }
  } catch (error) {
    return {
      name: 'エンドポイントの疎通（署名不正に 401 を返すか）',
      ok: false,
      detail: `${url} → 届かなかった（${error instanceof Error ? error.message : String(error)}）`,
    }
  }
}

const main = async (): Promise<number> => {
  const origin = process.argv[2]

  const checks = [
    ...(await commandChecks()),
    ...(origin === undefined ? [] : [await endpointCheck(origin)]),
  ]

  if (origin === undefined) {
    console.log('（エンドポイントの疎通を見るには、確かめたい URL を引数に渡す）')
  }

  return report(checks)
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })

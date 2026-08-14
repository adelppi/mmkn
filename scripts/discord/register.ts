import { applicationCommand } from '../../src/adapter/discord/definitions'
import { listRegisteredCommands, registerCommands } from '../../src/infra/discord/client'
import { application } from './application'
import { commandDifferences, describeDifferences } from './shape'

/**
 * スラッシュコマンドを Discord に登録する（`docs/adr/0006-discord-http-interactions.md`
 * 「コマンド登録の運用」）。
 *
 * **登録はデプロイと別作業である。** コマンド定義はソース上に存在するだけでは何も起きず、
 * Discord の API へ登録して初めてクライアントに表示される。
 *
 * **登録する内容の正は `src/adapter/discord/definitions.ts` の宣言である。**
 * ここはそれを送るだけで、コマンドの一覧を持たない。
 *
 * ```
 * npm run discord:register          差分があれば登録する
 * npm run discord:register -- --force   差分が無くても登録し直す
 * ```
 *
 * **リリースの 4 段目としても、これがそのまま走る**（`.github/workflows/main.yml`）。
 * **差分があるときだけ登録する判定はここにあり**、走らせ方の側は持たない
 * （`docs/adr/0011-ci-and-release.md`「main へのマージ時に走らせるもの」）。
 */
const main = async (): Promise<number> => {
  const forced = process.argv.includes('--force')
  const target = application()
  const declared = [applicationCommand()]

  const registered = await listRegisteredCommands(target)
  const differences = commandDifferences({ declared, registered })

  console.log(describeDifferences(differences))

  if (differences.length === 0 && !forced) {
    console.log('登録するものはない（--force で登録し直せる）')
    return 0
  }

  await registerCommands(target, declared)
  console.log('登録した。**グローバル登録は反映まで最大 1 時間かかる。**')

  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })

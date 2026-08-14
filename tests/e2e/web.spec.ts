import { expect, test, type Browser, type Page } from '@playwright/test'

/**
 * Web の一巡（`docs/adr/0010-testing.md`「E2E の範囲」）。
 *
 * ```
 * グループ作成 → 参加 → 支払いの記録 → 清算案の表示 → 清算案からの送金記録
 * ```
 *
 * **確かめるのは、画面と画面のつながりが実際に成立することである。** 同じ操作が同じ結果になるか
 * （クライアント間の整合）は `tests/client-parity/` が、計算そのものは単体テストが持つ。
 * **ここで細かい文言や金額の書式を固定しない。**
 *
 * **外部サービスの認可画面はまたがない**（同上）。ログインの往復は偽の認証が受け持つ
 * （`src/infra/auth/stub.ts`）。
 */

/** その人としてログインし、アカウントを作る。**アプリは空の DB から始まる。** */
const signUp = async (browser: Browser, origin: string, identifier: string, name: string) => {
  const context = await browser.newContext()

  // **誰としてログインするかを先に置く。** 本物では認可画面で選ぶところにあたる。
  await context.addCookies([{ name: 'mmkn-e2e-login-as', value: identifier, url: origin }])

  const page = await context.newPage()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Google で続ける' }).click()

  // **ここだけ、偽の認証と本物とで往復の形が違う。** 本物は外部の認可画面へブラウザごと出て、
  // そこから戻ってくる。偽の認証は同じ origin の中に留まるため、**戻りの 1 回分をここで開く。**
  // アプリが決めた戻り先をそのまま使う（行き先を E2E 側で組み立てない）。
  await expect(page).toHaveURL(/\/auth\/callback\?code=/)
  await page.goto(page.url())

  // User がまだいないため、名前を決める画面に着く（`docs/domain/group.md`「ログインする」）。
  await expect(page).toHaveURL(/\/signup$/)
  await page.getByLabel('名前', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'はじめる' }).click()

  // ログイン済みの画面（グループ一覧）に着く。
  await expect(page.getByRole('link', { name: 'グループを作成' })).toBeVisible()

  return { context, page }
}

/** グループの中の画面へ移る。 */
const goTo = async (page: Page, groupUrl: string, path = '') => {
  await page.goto(`${groupUrl}${path}`)
}

test('Web の一巡（グループ作成 → 参加 → 支払い → 清算案 → 送金の記録）', async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL ?? ''

  const taro = await signUp(browser, origin, 'e2e-taro', 'たろう')
  const jiro = await signUp(browser, origin, 'e2e-jiro', 'じろう')

  // ── グループを作成する（`docs/features.md` #1）──────────────────────────────
  await taro.page.goto('/groups/new')
  await taro.page.getByLabel('グループ名').fill('E2E 旅行')
  await taro.page.getByRole('button', { name: '作成する' }).click()

  // `/groups/new` と区別する（作成の前後で形が似ているため）。
  await expect(taro.page).toHaveURL(/\/groups\/(?!new$)[^/]+$/)
  const groupUrl = taro.page.url()

  // ── 参加コードを渡す（`docs/domain/group.md`「Group の属性」：共有リンクとしてだけ出る）──
  await goTo(taro.page, groupUrl, '/settings')
  const inviteUrl = await taro.page.getByText(/\/j\//).innerText()
  const invitePath = new URL(inviteUrl.trim()).pathname

  // ── グループに参加する（`docs/features.md` #2）───────────────────────────────
  await jiro.page.goto(invitePath)
  await expect(jiro.page.getByText('E2E 旅行')).toBeVisible()
  await jiro.page.getByRole('button', { name: '参加する' }).click()

  await expect(jiro.page).toHaveURL(/\/groups\/[^/]+$/)

  // ── 支払いを記録する（`docs/features.md` #5）─────────────────────────────────
  await goTo(taro.page, groupUrl)
  await taro.page.getByRole('link', { name: '支払いを記録する' }).click()

  await taro.page.getByLabel('金額').fill('1000')
  await taro.page.locator('#payer').getByText('たろう').click()
  await taro.page.locator('#bearers').getByText('たろう').click()
  await taro.page.locator('#bearers').getByText('じろう').click()
  await taro.page.getByLabel('内容（任意）').fill('宿代')
  await taro.page.getByRole('button', { name: '記録する' }).click()

  // **済んだことが伝わる**（設計「トースト」）。押しっぱなしにも、何も起きないようにも見えない。
  await expect(taro.page.getByRole('status').filter({ hasText: '支払いを記録しました' })).toBeVisible()
  await expect(taro.page.getByText('宿代')).toBeVisible()

  // ── タブを切り替える（設計 03〜05）────────────────────────────────────────────
  // **上端はタブで共有される**（`docs/adr/0009-web-ui.md`「上端を共有する」）。
  // 切り替えても同じグループ名がそこに在り続け、選択だけが移る。
  const tab = (name: string) => taro.page.getByRole('link', { name, exact: true })

  await tab('収支').click()
  await expect(taro.page).toHaveURL(/\/balances$/)
  await expect(tab('収支')).toHaveAttribute('aria-current', 'page')
  await expect(taro.page.getByRole('link', { name: 'E2E 旅行' })).toBeVisible()

  await tab('記録').click()
  await expect(taro.page).toHaveURL(/\/groups\/[^/]+$/)
  await expect(tab('記録')).toHaveAttribute('aria-current', 'page')
  await expect(taro.page.getByRole('link', { name: 'E2E 旅行' })).toBeVisible()

  // ── 清算案を見る（`docs/features.md` #9）────────────────────────────────────
  // たろうが 1000 を払い、2 人で負担した。**じろう → たろう の 1 件になる。**
  await goTo(jiro.page, groupUrl, '/settlement')
  const row = jiro.page.getByRole('listitem').filter({ hasText: 'じろう → たろう' })
  await expect(row).toBeVisible()

  // ── 清算案から送金を記録する（`docs/features.md` #10）────────────────────────
  // **金額は入力しない。** 登録の時点で導出し直される（`docs/domain/settlement.md`）。
  await row.getByRole('button', { name: '送金した' }).click()

  // **記録できたことは知らせで伝わる**（設計「トースト」）。額は登録の時点で導出し直したもの。
  await expect(
    jiro.page.getByRole('status').filter({ hasText: 'の送金を記録しました' }),
  ).toBeVisible()

  // 記録された結果、送るお金が無くなる。
  await expect(jiro.page.getByText('送る必要のあるお金はありません')).toBeVisible()

  // **記録として残る。** 清算案は保存されず、残るのは登録された送金だけである
  // （`docs/domain/settlement.md`）。
  await goTo(jiro.page, groupUrl)
  await expect(jiro.page.getByText('じろう → たろう')).toBeVisible()

  // ── 記録を削除する（`docs/features.md` #7）──────────────────────────────────
  // **取り消しの導線を持たない**（`docs/domain/record.md`「削除」：削除履歴を残さない）。
  await taro.page.getByText('宿代').click()
  await taro.page.getByRole('button', { name: '削除する' }).first().click()
  await taro.page.getByRole('dialog').getByRole('button', { name: '削除する' }).click()

  const removed = taro.page.getByRole('status').filter({ hasText: '記録を削除しました' })
  await expect(removed).toBeVisible()
  await expect(removed.getByRole('button')).toHaveCount(0)
  await expect(removed.getByRole('link')).toHaveCount(0)

  await expect(taro.page.getByText('宿代')).toHaveCount(0)

  await taro.context.close()
  await jiro.context.close()
})

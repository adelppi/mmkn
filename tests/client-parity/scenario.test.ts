import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FIELD } from '@/src/adapter/discord/definitions'
import { createGroup as webCreateGroup } from '@/src/adapter/web/controller/group'
import { saveRecord as webSaveRecord } from '@/src/adapter/web/controller/record'
import { registerSettlementTransfer as webRegisterSettlementTransfer } from '@/src/adapter/web/controller/settlement'
import { initialCreateGroupView } from '@/src/adapter/web/presenter/group'
import {
  emptyRecordForm,
  initialRecordFormView,
} from '@/src/adapter/web/presenter/record'
import { initialSettlementTransferView } from '@/src/adapter/web/presenter/settlement'
import { toGroupId, type GroupId } from '@/src/domain/id'
import type { TestDatabase } from '@/src/infra/db/test-support'
import {
  buttonsOf,
  carriedMembersOf,
  chosen,
  commandInteraction,
  componentInteraction,
  dispatch,
  modalChoicesOf,
  modalInteraction,
  signer,
  type Signer,
} from './discord'
import {
  connect,
  disconnect,
  discordIds,
  environment,
  freshHarness,
  projectionOf,
  users,
  type Harness,
  type Projection,
} from './harness'

/**
 * クライアント間の整合（`docs/adr/0010-testing.md`「クライアント間の整合をどう固定するか」）。
 *
 * ```
 * グループを作る → 支払いを記録する → 収支を見る → 清算案から送金を記録する
 *
 *   ① Server Action 経由で一巡させる
 *   ② 署名付き Interaction 経由で同じ操作を一巡させる
 *   ③ ①と②の結果できた記録が一致することを検証する
 * ```
 *
 * **呼び先の一致を型やスパイで見るのではなく、結果で見る。** 守りたいのは呼び出し構造ではなく、
 * ユーザーから見える振る舞いだからである（`docs/overview.md`「2 つの提供形態で機能に差を設けない」）。
 *
 * **シナリオは 1 本だけである**（`docs/adr/0010`「留意点」：差が出るのは入口だけなので、
 * 通す経路の種類を増やすより 1 本を確実に保つ）。
 *
 * **参加だけは共通の下ごしらえとして、どちらの run でもユースケースを直接呼ぶ。**
 * 上の 4 手にはなく、Discord にその入口が無いためである。ここを片方だけ入口経由にすると、
 * 比べているものが「入口の違い」から「経路の違い」にすり替わる。
 */

const GROUP_NAME = '沖縄旅行'
const CURRENCY = 'JPY'
const AMOUNT = '10000'
const DESCRIPTION = 'ホテル'
const OCCURRED_ON = environment.today

const TARO = 'たろう'
const JIRO = 'じろう'

let database: TestDatabase
let keys: Signer

beforeAll(async () => {
  database = await connect()
  keys = await signer()
}, 60_000)

afterAll(async () => {
  await disconnect(database)
})

const formData = (entries: Readonly<Record<string, string | readonly string[]>>): FormData => {
  const data = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    if (Array.isArray(value)) for (const it of value) data.append(name, it)
    else data.append(name, value as string)
  }
  return data
}

/** 参加（共通の下ごしらえ）。**シナリオの 4 手には含まれない。** */
const letJiroJoin = async (harness: Harness, group: GroupId): Promise<void> => {
  const viewed = await harness.usecases.viewGroup({ actor: users.taro.id, group })
  if (!viewed.ok) throw new Error('参加コードを読めなかった')

  const joined = await harness.usecases.joinGroup({
    actor: users.jiro.id,
    inviteCode: viewed.value.group.inviteCode,
    displayName: JIRO,
  })
  if (!joined.ok) throw new Error('前提の参加に失敗した')
}

const memberIdOf = async (
  harness: Harness,
  group: GroupId,
  displayName: string,
): Promise<string> => {
  const viewed = await harness.usecases.viewGroup({ actor: users.taro.id, group })
  if (!viewed.ok) throw new Error('Group を読めなかった')

  const member = viewed.value.group.members.find((it) => it.displayName === displayName)
  if (member === undefined) throw new Error(`${displayName} が Member にいない`)

  return member.id
}

// ── ① Web（Server Action が呼ぶ Controller）────────────────────────────────────

const runWeb = async (harness: Harness): Promise<Projection> => {
  const actor = users.taro.id

  // 1. グループを作る
  const created = await webCreateGroup({ createGroup: harness.usecases.createGroup, actor })(
    initialCreateGroupView(CURRENCY),
    formData({ name: GROUP_NAME, defaultCurrency: CURRENCY }),
  )
  if (created.kind !== 'created') throw new Error('Web でグループを作れなかった')

  const group = toGroupId(created.redirectTo.split('/').at(-1) ?? '')

  await letJiroJoin(harness, group)

  const taroMember = await memberIdOf(harness, group, TARO)
  const jiroMember = await memberIdOf(harness, group, JIRO)

  // 2. 支払いを記録する
  const saved = await webSaveRecord({ ...harness.usecases, actor })(
    initialRecordFormView(emptyRecordForm(group, 'payment')),
    formData({
      groupId: group,
      type: 'payment',
      amount: AMOUNT,
      currency: CURRENCY,
      payer: taroMember,
      bearers: [taroMember, jiroMember],
      occurredOn: OCCURRED_ON,
      description: DESCRIPTION,
    }),
  )
  if (saved.kind !== 'saved') throw new Error('Web で支払いを記録できなかった')

  // 3. 収支を見る（**読み取りもユースケースを通る**。`docs/adr/0005`）
  const settlement = await harness.usecases.viewSettlement({ actor, group })
  if (!settlement.ok) throw new Error('Web で収支を読めなかった')

  // 4. 清算案から送金を記録する。**送り手はじろう**（清算案が示す向き）
  const registered = await webRegisterSettlementTransfer({
    registerSettlementTransfer: harness.usecases.registerSettlementTransfer,
    actor: users.jiro.id,
  })(
    initialSettlementTransferView(),
    formData({
      groupId: group,
      sender: jiroMember,
      recipient: taroMember,
      currency: CURRENCY,
      occurredOn: OCCURRED_ON,
    }),
  )
  if (registered.kind !== 'registered') throw new Error('Web で清算案の送金を記録できなかった')

  return await projectionOf(harness, { actor, group })
}

// ── ② Discord（署名付き Interaction）──────────────────────────────────────────

const runDiscord = async (harness: Harness): Promise<Projection> => {
  const send = async (interaction: Parameters<typeof dispatch>[0]['interaction']) =>
    await dispatch({ usecases: harness.usecases, signer: keys, interaction })

  // 1. グループを作る（コマンド → モーダル → 送信）
  const opened = await send(commandInteraction({ by: discordIds.taro, name: 'create' }))
  if (opened.modal === undefined) throw new Error('作成のモーダルが開かなかった')

  const createdReply = await send(
    modalInteraction({
      by: discordIds.taro,
      customId: opened.modal.custom_id,
      texts: { [FIELD.groupName]: GROUP_NAME, [FIELD.defaultCurrency]: CURRENCY },
    }),
  )
  const assignButton = buttonsOf(createdReply.followUp?.reply ?? { embeds: [], components: [] })[0]
  if (assignButton === undefined) throw new Error('Discord でグループを作れなかった')

  // このチャンネルに対応づける（**対応づけは参加ではない**。`docs/domain/group.md`）
  await send(componentInteraction({ by: discordIds.taro, customId: assignButton.custom_id }))

  const group = toGroupId(assignButton.custom_id.split(':').at(-1) ?? '')

  await letJiroJoin(harness, group)

  // 2. 支払いを記録する（コマンド → 候補を載せた返信 → ボタン → モーダル → 送信）
  const input = await send(commandInteraction({ by: discordIds.taro, name: 'payment' }))
  const carrierReply = input.followUp?.reply ?? { embeds: [], components: [] }

  // **候補はメッセージに載って運ばれる**（`docs/adr/0006`「負担者の選択とモーダルを直列にしない」）
  expect(carriedMembersOf(carrierReply).map((it) => it.label).sort()).toEqual([JIRO, TARO])

  const openButton = buttonsOf(carrierReply)[0]
  if (openButton === undefined) throw new Error('入力をひらくボタンが無い')

  const modal = await send(
    componentInteraction({
      by: discordIds.taro,
      customId: openButton.custom_id,
      message: { components: carrierReply.components },
    }),
  )
  if (modal.modal === undefined) throw new Error('支払いのモーダルが開かなかった')

  const choices = modalChoicesOf(modal.modal, FIELD.payer)

  const paymentReply = await send(
    modalInteraction({
      by: discordIds.taro,
      customId: modal.modal.custom_id,
      texts: {
        [FIELD.amount]: AMOUNT,
        [FIELD.occurredOn]: OCCURRED_ON,
        [FIELD.description]: DESCRIPTION,
      },
      selections: {
        [FIELD.payer]: [chosen(choices, TARO)],
        [FIELD.bearers]: [chosen(choices, TARO), chosen(choices, JIRO)],
      },
    }),
  )
  expect(paymentReply.followUp?.reply.embeds[0]?.title).toBe('支払いを記録しました')

  // 3. 収支を見る
  const balance = await send(commandInteraction({ by: discordIds.taro, name: 'balance' }))
  expect(balance.followUp?.reply.embeds[0]?.fields).toHaveLength(2)

  // 4. 清算案から送金を記録する（**送り手は押下者に固定される**ため、じろうが押す）
  const settlement = await send(commandInteraction({ by: discordIds.taro, name: 'settlement' }))
  const settleButton = buttonsOf(settlement.followUp?.reply ?? { embeds: [], components: [] })[0]
  if (settleButton === undefined) throw new Error('清算案に送金のボタンが無い')

  const settled = await send(
    componentInteraction({ by: discordIds.jiro, customId: settleButton.custom_id }),
  )
  expect(settled.followUp?.reply.embeds[0]?.title).toBe('送金を記録しました')
  // 送るお金が無くなったため、**部品は空で明示的に返る**（古いボタンを残さない）
  expect(settled.followUp?.reply.components).toEqual([])

  return await projectionOf(harness, { actor: users.taro.id, group })
}

// ── ③ 結果の一致 ─────────────────────────────────────────────────────────────

describe('同じシナリオを Web と Discord の両方から流す', () => {
  let web: Projection
  let discord: Projection

  beforeAll(async () => {
    web = await runWeb(await freshHarness(database))
    // **DB を空にしてからもう一巡する。** 片方の記録が混ざると「一致した」の意味が消える。
    discord = await runDiscord(await freshHarness(database))
  }, 120_000)

  it('できあがった記録が一致する', () => {
    expect(discord).toEqual(web)
  })

  it('支払いが 1 件、送金が 1 件だけできている', () => {
    expect(web.payments).toHaveLength(1)
    expect(web.transfers).toHaveLength(1)
  })

  it('負担額の配分が同じ', () => {
    // **並びは配分順序（識別子による決定的な順序）であり、入力した順ではない**
    // （`docs/domain/record.md`「負担額の配分」）。ここで見るのは配分の中身のほう。
    const sorted = (projection: Projection) =>
      [...(projection.payments[0]?.shares ?? [])].sort()

    expect(sorted(web)).toEqual([
      [JIRO, 5_000],
      [TARO, 5_000],
    ])
    expect(sorted(discord)).toEqual(sorted(web))
  })

  it('清算案の送金を記録したあと、収支はどちらも 0 になる', () => {
    expect(web.balances[0]?.rows.map(([, amount]) => amount)).toEqual([0, 0])
    expect(web.settlements[0]?.transfers).toEqual([])
  })

  it('金額を入力しなくても、清算案が示した額が記録されている', () => {
    // Discord のボタンは金額を載せない。**登録の時点で導出し直した額**が入る。
    expect(discord.transfers[0]).toMatchObject({ sender: JIRO, recipient: TARO, amount: 5_000 })
  })

  it('Member の並びや識別子に依らず、同じ表示名の同じ額になる', () => {
    expect(discord.members).toEqual(web.members)
    expect(discord.balances).toEqual(web.balances)
  })
})

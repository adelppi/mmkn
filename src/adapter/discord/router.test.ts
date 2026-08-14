import type { APIInteraction } from 'discord-api-types/v10'
import { describe, expect, it } from 'vitest'
import { toGroupId, toMemberId, toTransferId, toUserId } from '../../domain/id'
import { Transfer } from '../../domain/record/transfer'
import { err, ok } from '../../domain/result'
import { groupOf, jiro, taro } from '../../usecase/fixture'
import { customId, MEMBER_OPTIONS_FIELD } from './definitions'
import { COMPONENT, EPHEMERAL_FLAG, INTERACTION, RESPONSE } from './protocol'
import { route, type DiscordUseCases, type Environment } from './router'

/**
 * Interaction の振り分け（`docs/adr/0006-discord-http-interactions.md`
 * 「扱う Interaction 種別と、defer の適用範囲」「返信の可視性」）。
 *
 * ここで固定するのは 3 つ。
 *
 * - **メッセージで応答する Interaction が一律 deferred で、defer できないものはそうしていないこと**
 * - **可視性が宣言のとおりに、defer の時点で使われること**
 * - **モーダルを開く応答とオートコンプリートが、ユースケースを 1 つも呼ばないこと**
 *   （＝永続化に問い合わせないこと。3 秒の枠に DB への往復を入れない）
 */

const group = groupOf([
  { user: taro, memberId: 'm1' },
  { user: jiro, memberId: 'm2' },
])

const transfer = (() => {
  const created = Transfer.create({
    id: toTransferId('t1'),
    group,
    sender: toMemberId('m1'),
    recipient: toMemberId('m2'),
    amount: 5_000,
    currency: 'JPY',
    occurredOn: '2026-08-14',
    recordedBy: taro.id,
    recordedAt: new Date('2026-08-14T00:00:00Z'),
  })
  if (!created.ok) throw new Error('前提の Transfer を作れなかった')
  return created.value
})()

const environment: Environment = { origin: 'https://mmkn.example', today: '2026-08-14' }

/** 呼ばれたユースケースを記録する。**呼ばれないことを見るために要る。** */
const spied = (overrides: Partial<DiscordUseCases> = {}) => {
  const called: string[] = []

  const base = {
    resolveActor: async () => ok({ actor: toUserId('u1') }),
    resolvePlace: async () => ok({ group: toGroupId('g1') }),
    listGroups: async () => ok({ groups: [{ group, balances: [] }] }),
    releasePlace: async () => ok(undefined),
    assignPlace: async () => ok({ place: { service: 'discord', id: 'ch1' }, groupId: group.id }),
    viewGroup: async () => ok({ group, viewer: group.members[0]! }),
    viewSettlement: async () => ok({ group, balances: [], settlements: [] }),
    createGroup: async () => ok(group),
    registerPayment: async () => err({ kind: 'amountNotPositiveInteger' as const }),
    registerTransfer: async () => ok({ record: transfer, version: 1 }),
    registerSettlementTransfer: async () => ok({ record: transfer, version: 1 }),
    ...overrides,
  } as unknown as DiscordUseCases

  const usecases = Object.fromEntries(
    Object.entries(base).map(([name, run]) => [
      name,
      async (input: unknown) => {
        called.push(name)
        return await (run as (it: unknown) => Promise<unknown>)(input)
      },
    ]),
  ) as DiscordUseCases

  return { usecases, called }
}

const base = {
  id: 'i1',
  application_id: 'app',
  token: 'token',
  version: 1,
  channel: { id: 'ch1' },
  member: { user: { id: '1234567890' } },
}

const commandOf = (name: string, options: unknown[] = []): APIInteraction =>
  ({
    ...base,
    type: INTERACTION.applicationCommand,
    data: { id: 'c1', name: 'mmkn', type: 1, options: [{ type: 1, name, options }] },
  }) as unknown as APIInteraction

const componentOf = (id: string, values: string[] = [], message: unknown = {}): APIInteraction =>
  ({
    ...base,
    type: INTERACTION.messageComponent,
    message,
    data: { custom_id: id, component_type: values.length > 0 ? 3 : 2, values },
  }) as unknown as APIInteraction

const modalOf = (id: string, components: unknown[] = []): APIInteraction =>
  ({
    ...base,
    type: INTERACTION.modalSubmit,
    data: { custom_id: id, components },
  }) as unknown as APIInteraction

const run = (interaction: APIInteraction, overrides: Partial<DiscordUseCases> = {}) => {
  const { usecases, called } = spied(overrides)
  return { outcome: route(usecases, environment)(interaction), called }
}

/** 応答に添えられた中身（モーダルの定義・候補リスト）。**添えない応答もある。** */
const dataOf = (outcome: ReturnType<ReturnType<typeof route>> | undefined): unknown => {
  const response = outcome?.response
  return response !== undefined && 'data' in response ? response.data : undefined
}

describe('PING', () => {
  it('PONG だけを即座に返す。defer しない', () => {
    const { outcome, called } = run({ ...base, type: INTERACTION.ping } as unknown as APIInteraction)

    expect(outcome?.response).toEqual({ type: RESPONSE.pong })
    expect(outcome?.followUp).toBeUndefined()
    expect(called).toEqual([])
  })
})

describe('スラッシュコマンド', () => {
  it('メッセージで応答するものは deferred で、本文は follow-up で送る', async () => {
    const { outcome } = run(commandOf('balance'))

    expect(outcome?.response.type).toBe(RESPONSE.deferredMessage)
    expect(outcome?.followUp).toBeDefined()
  })

  it('収支は公開で defer する（可視性は defer の時点で使われる）', () => {
    const { outcome } = run(commandOf('balance'))

    expect(outcome?.response).toEqual({ type: RESPONSE.deferredMessage, data: {} })
  })

  it('入力途中のやり取りは実行者のみで defer する', () => {
    const { outcome } = run(commandOf('payment'))

    expect(outcome?.response).toEqual({
      type: RESPONSE.deferredMessage,
      data: { flags: EPHEMERAL_FLAG },
    })
  })

  it('モーダルを開くコマンドは defer せず、ユースケースを 1 つも呼ばない', () => {
    const { outcome, called } = run(commandOf('create'))

    expect(outcome?.response.type).toBe(RESPONSE.modal)
    expect(outcome?.followUp).toBeUndefined()
    expect(called).toEqual([])
  })

  it('知らないサブコマンドでも、実行者のみの案内を返す', async () => {
    const { outcome } = run(commandOf('しらない'))

    expect(outcome?.response).toEqual({
      type: RESPONSE.deferredMessage,
      data: { flags: EPHEMERAL_FLAG },
    })
    expect((await outcome?.followUp?.())?.reply.embeds[0]?.title).toContain('知らないコマンド')
  })
})

describe('オートコンプリート', () => {
  it('候補をその場で返しきる。defer しない', () => {
    const interaction = {
      ...base,
      type: INTERACTION.autocomplete,
      data: {
        id: 'c1',
        name: 'mmkn',
        type: 1,
        options: [
          { type: 1, name: 'payment', options: [{ type: 3, name: 'currency', value: 'JP', focused: true }] },
        ],
      },
    } as unknown as APIInteraction

    const { outcome, called } = run(interaction)

    expect(outcome?.response.type).toBe(RESPONSE.autocompleteResult)
    expect(outcome?.followUp).toBeUndefined()
    // **永続化への問い合わせを含めない。** 候補は domain の通貨表から静的に絞り込む。
    expect(called).toEqual([])
  })

  it('入力した文字で絞り込む', () => {
    const interaction = {
      ...base,
      type: INTERACTION.autocomplete,
      data: {
        id: 'c1',
        name: 'mmkn',
        type: 1,
        options: [
          { type: 1, name: 'payment', options: [{ type: 3, name: 'currency', value: 'JP', focused: true }] },
        ],
      },
    } as unknown as APIInteraction

    const { outcome } = run(interaction)
    const data = dataOf(outcome) as { choices: { value: string }[] }

    expect(data.choices.map((it) => it.value)).toEqual(['JPY'])
  })
})

describe('メッセージ部品', () => {
  const carrier = {
    components: [
      {
        type: COMPONENT.actionRow,
        components: [
          {
            type: COMPONENT.stringSelect,
            custom_id: MEMBER_OPTIONS_FIELD,
            options: [
              { value: 'm1', label: 'たろう' },
              { value: 'm2', label: 'じろう' },
            ],
          },
        ],
      },
    ],
  }

  it('入力をひらくボタンは、その場でモーダルを返し、ユースケースを 1 つも呼ばない', () => {
    const { outcome, called } = run(
      componentOf(customId('open-payment', 'JPY', '2026-08-14', 'm1'), [], carrier),
    )

    expect(outcome?.response.type).toBe(RESPONSE.modal)
    expect(outcome?.followUp).toBeUndefined()
    expect(called).toEqual([])
  })

  it('候補は、押されたメッセージに載っていたものから復元する', () => {
    const { outcome } = run(
      componentOf(customId('open-payment', 'JPY', '2026-08-14', 'm1'), [], carrier),
    )

    const data = dataOf(outcome) as {
      components: { component: { custom_id: string; options?: unknown[] } }[]
    }
    const bearers = data.components.find((slot) => slot.component.custom_id === 'bearers')

    expect(bearers?.component.options).toHaveLength(2)
  })

  it('清算案のボタンは、元のメッセージを差し替える形で defer する', () => {
    const { outcome } = run(componentOf(customId('settle', 'm2', 'JPY')))

    expect(outcome?.response).toEqual({ type: RESPONSE.deferredUpdate })
  })

  it('清算案のボタンは、送り手を押下者に固定して登録する', async () => {
    let sender: string | undefined
    const { outcome } = run(componentOf(customId('settle', 'm2', 'JPY')), {
      registerSettlementTransfer: (async (input: { sender: string }) => {
        sender = input.sender
        return ok({ record: transfer, version: 1 })
      }) as unknown as DiscordUseCases['registerSettlementTransfer'],
    })

    await outcome?.followUp?.()

    // 押下者の Member（`viewGroup` が返す viewer）が送り手になる。
    expect(sender).toBe('m1')
  })

  it('押下者が Member でなければ、元のメッセージには触れず押下者だけに返す', async () => {
    const { outcome } = run(componentOf(customId('settle', 'm2', 'JPY')), {
      viewGroup: (async () => err({ kind: 'notMember' })) as unknown as DiscordUseCases['viewGroup'],
    })

    const followUp = await outcome?.followUp?.()

    expect(followUp?.target).toBe('aside')
  })

  it('登録できてもできなくても、清算案は最新に描き直す', async () => {
    const { outcome } = run(componentOf(customId('settle', 'm2', 'JPY')), {
      registerSettlementTransfer: (async () =>
        err({ kind: 'settlementChanged' })) as unknown as DiscordUseCases['registerSettlementTransfer'],
    })

    const followUp = await outcome?.followUp?.()

    expect(followUp?.target).toBe('original')
    expect(followUp?.reply.embeds[0]?.title).toContain('記録しませんでした')
    // 送るお金が無くなった清算案なので、ボタンは空で明示的に返る。
    expect(followUp?.reply.components).toEqual([])
  })
})

describe('モーダルの送信', () => {
  const values = [
    { type: COMPONENT.label, component: { type: COMPONENT.textInput, custom_id: 'amount', value: '5000' } },
    { type: COMPONENT.label, component: { type: COMPONENT.stringSelect, custom_id: 'sender', values: ['m1'] } },
    { type: COMPONENT.label, component: { type: COMPONENT.stringSelect, custom_id: 'recipient', values: ['m2'] } },
    { type: COMPONENT.label, component: { type: COMPONENT.textInput, custom_id: 'occurred-on', value: '2026-08-14' } },
  ]

  it('登録結果は公開で defer する', () => {
    const { outcome } = run(modalOf(customId('transfer', 'JPY'), values))

    expect(outcome?.response).toEqual({ type: RESPONSE.deferredMessage, data: {} })
  })

  it('グループの作成結果は実行者のみで defer する（参加リンクを含むため）', () => {
    const { outcome } = run(modalOf(customId('create-group'), []))

    expect(outcome?.response).toEqual({
      type: RESPONSE.deferredMessage,
      data: { flags: EPHEMERAL_FLAG },
    })
  })

  it('モーダルで入力された値が、そのままユースケースの入力になる', async () => {
    let received: Record<string, unknown> = {}
    const { outcome } = run(modalOf(customId('transfer', 'JPY'), values), {
      registerTransfer: (async (input: Record<string, unknown>) => {
        received = input
        return ok({ record: transfer, version: 1 })
      }) as unknown as DiscordUseCases['registerTransfer'],
    })

    await outcome?.followUp?.()

    expect(received).toMatchObject({
      sender: 'm1',
      recipient: 'm2',
      amount: 5_000,
      currency: 'JPY',
      occurredOn: '2026-08-14',
      group: toGroupId('g1'),
    })
  })

  it('失敗はそのまま伝わる。握りつぶさない', async () => {
    const { outcome } = run(modalOf(customId('transfer', 'JPY'), values), {
      registerTransfer: (async () =>
        err({ kind: 'sameSenderAndRecipient' })) as unknown as DiscordUseCases['registerTransfer'],
    })

    const followUp = await outcome?.followUp?.()

    expect(followUp?.reply.embeds[0]?.description).toContain('別の人にしてください')
  })
})

describe('操作の主と対象の解決', () => {
  it('mmkn のアカウントをまだ持っていない人には案内が返り、記録は何も変わらない', async () => {
    const { outcome, called } = run(commandOf('balance'), {
      resolveActor: (async () => err({ kind: 'noAccount' })) as unknown as DiscordUseCases['resolveActor'],
    })

    const followUp = await outcome?.followUp?.()

    expect(followUp?.reply.embeds[0]?.title).toContain('mmkn のアカウントが必要です')
    expect(called).toEqual(['resolveActor'])
  })

  it('対応づけられていないチャンネルからの操作には案内が返る', async () => {
    const { outcome } = run(commandOf('balance'), {
      resolvePlace: (async () =>
        err({ kind: 'placeNotAssigned' })) as unknown as DiscordUseCases['resolvePlace'],
    })

    const followUp = await outcome?.followUp?.()

    expect(followUp?.reply.embeds[0]?.description).toContain('対応づけられていません')
  })

  it('ユースケースにはチャンネルではなく Group を渡す', async () => {
    let received: Record<string, unknown> = {}
    const { outcome } = run(commandOf('balance'), {
      viewSettlement: (async (input: Record<string, unknown>) => {
        received = input
        return ok({ group, balances: [], settlements: [] })
      }) as unknown as DiscordUseCases['viewSettlement'],
    })

    await outcome?.followUp?.()

    expect(received).toEqual({ actor: toUserId('u1'), group: toGroupId('g1') })
    expect(received['place']).toBeUndefined()
  })
})

describe('扱わない種別', () => {
  it('知らない Interaction には何も返さない（入口が拒む）', () => {
    const { outcome } = run({ ...base, type: 99 } as unknown as APIInteraction)

    expect(outcome).toBeUndefined()
  })
})

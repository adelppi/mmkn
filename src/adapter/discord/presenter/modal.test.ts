import { describe, expect, it } from 'vitest'
import { GROUP_NAME_MAX_LENGTH } from '../../../domain/group/text'
import { DESCRIPTION_MAX_LENGTH } from '../../../domain/record/payment'
import { FIELD } from '../definitions'
import { COMPONENT } from '../protocol'
import { MAX_CHOICES, MAX_MODAL_COMPONENTS } from './limits'
import { createGroupModal, paymentModal, transferModal, type InputContext } from './modal'

/**
 * モーダルの組み立て（`docs/adr/0006-discord-http-interactions.md`「モーダル」「構造上の制約」）。
 *
 * **ここが永続化に問い合わせないことは、引数の形が保証している**（`InputContext` は
 * すべて Interaction のペイロードから復元できる値だけを持つ）。ここで固定するのは、
 * 出来上がるモーダルが Discord の器に収まることと、上限が `domain/` 由来であることである。
 */

const members = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ value: `m${i}`, label: `メンバー${i}` }))

const context = (count = 3): InputContext => ({
  currency: 'JPY',
  occurredOn: '2026-08-14',
  actorMemberId: 'm1',
  members: members(count),
})

/** `LABEL` に包まれた入力部品を、名前で引く。 */
const componentOf = (
  modal: { components: readonly unknown[] },
  name: string,
): Record<string, unknown> | undefined => {
  for (const slot of modal.components as Record<string, unknown>[]) {
    if (slot['type'] !== COMPONENT.label) continue

    const inner = slot['component'] as Record<string, unknown>
    if (inner['custom_id'] === name) return inner
  }
  return undefined
}

describe('グループを作るモーダル', () => {
  const modal = createGroupModal()

  it('部品は 5 つ以内', () => {
    expect(modal.components.length).toBeLessThanOrEqual(MAX_MODAL_COMPONENTS)
  })

  it('グループ名の上限を domain から取る（アダプタ側で数値を打たない）', () => {
    expect(componentOf(modal, FIELD.groupName)?.['max_length']).toBe(GROUP_NAME_MAX_LENGTH)
  })
})

describe('支払いのモーダル', () => {
  const modal = paymentModal(context())

  it('金額・負担する人・内容を 1 枚で受ける（モーダルとセレクトを直列にしない）', () => {
    expect(componentOf(modal, FIELD.amount)).toBeDefined()
    expect(componentOf(modal, FIELD.bearers)).toBeDefined()
    expect(componentOf(modal, FIELD.description)).toBeDefined()
  })

  it('部品は 5 つ以内', () => {
    expect(modal.components.length).toBeLessThanOrEqual(MAX_MODAL_COMPONENTS)
  })

  it('入力部品は LABEL に入る（メッセージ側の ACTION_ROW とは包み方が違う）', () => {
    expect(modal.components.every((slot) => slot.type === COMPONENT.label)).toBe(true)
  })

  it('内容の上限を domain から取る', () => {
    expect(componentOf(modal, FIELD.description)?.['max_length']).toBe(DESCRIPTION_MAX_LENGTH)
  })

  it('内容は任意（空でもよい）', () => {
    expect(componentOf(modal, FIELD.description)?.['required']).toBe(false)
  })

  it('負担する人は複数選べる', () => {
    expect(componentOf(modal, FIELD.bearers)?.['max_values']).toBeGreaterThan(1)
  })

  it('支払った人は、操作する人自身が選ばれた状態で出る', () => {
    const options = componentOf(modal, FIELD.payer)?.['options'] as { value: string; default?: boolean }[]

    expect(options.filter((option) => option.default === true).map((it) => it.value)).toEqual(['m1'])
  })

  it('発生日には初期値が入る', () => {
    expect(componentOf(modal, FIELD.occurredOn)?.['value']).toBe('2026-08-14')
  })

  it('候補が 25 件を超えたら切り詰める（Member が 25 人を超えるグループの制約）', () => {
    const many = paymentModal(context(30))
    const options = componentOf(many, FIELD.bearers)?.['options'] as unknown[]

    expect(options).toHaveLength(MAX_CHOICES)
  })
})

describe('送金のモーダル', () => {
  const modal = transferModal(context())

  it('送った人・受け取った人・金額を 1 枚で受ける', () => {
    expect(componentOf(modal, FIELD.sender)).toBeDefined()
    expect(componentOf(modal, FIELD.recipient)).toBeDefined()
    expect(componentOf(modal, FIELD.amount)).toBeDefined()
  })

  it('内容を持たない（送金そのものだけを記録する）', () => {
    expect(componentOf(modal, FIELD.description)).toBeUndefined()
  })

  it('部品は 5 つ以内', () => {
    expect(modal.components.length).toBeLessThanOrEqual(MAX_MODAL_COMPONENTS)
  })

  it('受け取った人は 1 人だけ選べる', () => {
    expect(componentOf(modal, FIELD.recipient)?.['max_values']).toBe(1)
  })
})

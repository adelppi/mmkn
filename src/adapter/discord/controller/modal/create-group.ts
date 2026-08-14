import type { Group } from '../../../../domain/group/group'
import type { CreateGroupError, CreateGroupInput } from '../../../../usecase/group/create-group'
import type { UseCase } from '../../../../usecase/usecase'
import { resolveActor, type ContextUseCases, type DiscordContext } from '../../context'
import { FIELD } from '../../definitions'
import type { ModalValues } from '../../payload'
import { toCreatedGroupReply } from '../../presenter/group'
import { denied, type Reply } from '../../presenter/reply'

/**
 * グループを作る（`docs/domain/group.md`「グループを作成する」・`docs/features.md` #1）。
 *
 * **作成者は自動的に Member になる。** 表示名の初期値にはその User の名前を使う。
 * **場との対応づけは起きない。** 対応づけは別の操作であり、続けて行えるようボタンを添える
 * （`presenter/group.ts`）。
 *
 * **入力の検査はここでしない。** 名前の長さも通貨のコードもドメイン層が判定し、
 * 失敗はそのまま文言になる（`CLAUDE.md`：同じルールを 2 か所に書かない）。
 */

export type CreateGroupUseCases = ContextUseCases & {
  readonly createGroup: UseCase<CreateGroupInput, Group, CreateGroupError>
}

export const createGroup =
  (deps: CreateGroupUseCases) =>
  async (context: DiscordContext, values: ModalValues): Promise<Reply> => {
    const actor = await resolveActor(deps, context)
    if (!actor.ok) return actor.error

    const created = await deps.createGroup({
      actor: actor.value,
      name: values.text(FIELD.groupName),
      defaultCurrency: values.text(FIELD.defaultCurrency),
    })
    if (!created.ok) return denied(created.error)

    return toCreatedGroupReply(created.value, context.origin)
  }

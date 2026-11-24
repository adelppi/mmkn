import { toGroupId, toMemberId, type UserId } from '../../../domain/id'
import type { Transfer } from '../../../domain/record/transfer'
import type {
  RegisterSettlementTransferError,
  RegisterSettlementTransferInput,
} from '../../../usecase/settlement/register-settlement-transfer'
import type { UseCase, Versioned } from '../../../usecase/usecase'
import { field } from '../presenter/form'
import {
  toSettlementTransferView,
  type SettlementTransferView,
} from '../presenter/settlement'

/**
 * 清算案からの送金記録（`docs/features.md` #10）。
 *
 * **画面に出ていた額を送り返す経路を作らない。** 作ると、変わった清算案の額が黙って記録される。
 */
export const registerSettlementTransfer =
  (deps: {
    registerSettlementTransfer: UseCase<
      RegisterSettlementTransferInput,
      Versioned<Transfer>,
      RegisterSettlementTransferError
    >
    actor: UserId | undefined
  }) =>
  async (_previous: SettlementTransferView, data: FormData): Promise<SettlementTransferView> => {
    const groupId = field(data, 'groupId')

    return toSettlementTransferView(
      groupId,
      await deps.registerSettlementTransfer({
        actor: deps.actor,
        group: toGroupId(groupId),
        sender: toMemberId(field(data, 'sender')),
        recipient: toMemberId(field(data, 'recipient')),
        currency: field(data, 'currency'),
        /** 発生日は操作した本人の手元で決まる（`docs/domain/record.md`「発生日」）。 */
        occurredOn: field(data, 'occurredOn'),
      }),
    )
  }

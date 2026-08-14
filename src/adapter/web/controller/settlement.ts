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
 * **金額を入力に取らない**（`docs/domain/settlement.md`「清算案の送金を記録する」）。
 * 送るのは「誰から誰へ、どの通貨で」だけで、額は登録の時点で導出し直される。
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
        /**
         * **発生日は入力で受け取る**（`docs/domain/record.md`「発生日」）。
         * 「今日」がどの日付かを決めるのは操作した本人の手元であり、サーバーの時計ではない。
         * 画面が手元の日付を入れて送る。
         */
        occurredOn: field(data, 'occurredOn'),
      }),
    )
  }

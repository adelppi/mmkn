import { createId } from '@paralleldrive/cuid2'
import type { InviteCodeGenerator } from '../../usecase/port/invite-code-generator'

/** `InviteCodeGenerator` の実装（`docs/adr/0002-invite-code.md`）。 */
export const cuid2InviteCodeGenerator: InviteCodeGenerator = {
  next: () => createId(),
}

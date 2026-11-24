import { USER_NAME_MAX_LENGTH } from '../../../domain/group/text'
import type { User } from '../../../domain/group/user'
import type { Result } from '../../../domain/result'
import type { CreateAccountError } from '../../../usecase/account/create-account'
import type { ViewAccountError } from '../../../usecase/account/view-account'
import type { TextFieldLimits } from './form'
import { messageOf } from './message'
import { route, type LoginFailure } from './route'

/** アカウントの表示（`docs/features.md` #11）。 */

// ── ログイン（`docs/domain/group.md`「ログインする」）─────────────────────────

export type LoginView =
  | { readonly kind: 'input'; readonly form: LoginFields; readonly start: string }
  | {
      readonly kind: 'failed'
      readonly form: LoginFields
      readonly start: string
      readonly message: string
    }

export type LoginFields = {
  /** 開いていた招待。**ログインしたあとに戻る**（`docs/domain/group.md`「ログインする」）。 */
  readonly inviteCode: string | undefined
}

/** ログインを始めるボタンの文言。どのサービスかの正は `docs/adr/0012-login.md`。 */
const START = 'Discord で続ける'

const LOGIN_FAILURES: readonly string[] = [
  'loginDenied',
  'loginFailed',
] satisfies readonly LoginFailure[]

const isLoginFailure = (value: string | undefined): value is LoginFailure =>
  value !== undefined && LOGIN_FAILURES.includes(value)

/** **読めない理由は、理由が無いのと同じに扱う。** 印は誰でも打てる。 */
export const toLoginView = (input: {
  readonly inviteCode?: string | undefined
  readonly failure?: string | undefined
}): LoginView => {
  const form = { inviteCode: input.inviteCode }

  return isLoginFailure(input.failure)
    ? { kind: 'failed', form, start: START, message: messageOf({ kind: input.failure }) }
    : { kind: 'input', form, start: START }
}

// ── アカウント作成（`docs/domain/group.md`「アカウントを作成する」）───────────

export type CreateAccountView =
  | { readonly kind: 'input'; readonly form: CreateAccountFields }
  | { readonly kind: 'invalid'; readonly form: CreateAccountFields; readonly message: string }
  | { readonly kind: 'created'; readonly form: CreateAccountFields; readonly redirectTo: string }

export type CreateAccountFields = {
  readonly name: string
  readonly nameLimits: TextFieldLimits
  /** 開いていた招待。**作成したあとに戻る**（`docs/domain/group.md`「アカウントを作成する」）。 */
  readonly inviteCode: string | undefined
}

const createAccountFields = (name: string, inviteCode: string | undefined): CreateAccountFields => ({
  name,
  inviteCode,
  // **数値はドメイン層の定数から取る**（`docs/adr/0009`「クライアント側の入力検査」）。
  nameLimits: { maxLength: USER_NAME_MAX_LENGTH, required: true },
})

/** 初期状態。**名前の入力欄は空から始まる**（`docs/domain/group.md`「アカウントを作成する」）。 */
export const initialCreateAccountView = (inviteCode?: string): CreateAccountView => ({
  kind: 'input',
  form: createAccountFields('', inviteCode),
})

/** `notAuthenticated` は**入口の側でだけ起こり得る失敗**で、ユースケースの失敗には無い。 */
export const toCreateAccountView = (
  input: { readonly name: string; readonly inviteCode?: string | undefined },
  result: Result<User, CreateAccountError | { readonly kind: 'notAuthenticated' }>,
): CreateAccountView =>
  result.ok
    ? {
        kind: 'created',
        form: createAccountFields(result.value.name, input.inviteCode),
        redirectTo: route.entrance(input.inviteCode),
      }
    : {
        kind: 'invalid',
        form: createAccountFields(input.name, input.inviteCode),
        message: messageOf(result.error),
      }

// ── アカウント ────────────────────────────────────────────────────────────────

export type AccountView =
  | { readonly kind: 'ok'; readonly name: string; readonly groupsHref: string }
  | { readonly kind: 'notAuthenticated'; readonly message: string; readonly loginHref: string }

export const toAccountView = (result: Result<User, ViewAccountError>): AccountView =>
  result.ok
    ? { kind: 'ok', name: result.value.name, groupsHref: route.groups() }
    : {
        kind: 'notAuthenticated',
        message: messageOf(result.error),
        loginHref: route.login(),
      }

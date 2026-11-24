import { USER_NAME_MAX_LENGTH } from '../../../domain/group/text'
import type { User } from '../../../domain/group/user'
import type { Result } from '../../../domain/result'
import type { CreateAccountError } from '../../../usecase/account/create-account'
import type { ViewAccountError } from '../../../usecase/account/view-account'
import type { TextFieldLimits } from './form'
import { messageOf } from './message'
import { route } from './route'

/**
 * アカウントの表示（`docs/features.md` #11）。
 *
 * **失敗はビューモデルのタグとして表す**（`docs/adr/0009-web-ui.md`「失敗の描画」）。
 * Container は成功と失敗で分岐せず、Presentational だけで失敗形も確認できる。
 *
 * **パスワードの入力欄も、再設定の導線もここに無い**（`docs/adr/0012-login.md`：
 * mmkn はパスワードを持たず、メールも送らない）。
 */

// ── ログイン（`docs/domain/group.md`「ログインする」）─────────────────────────

export type LoginView = {
  readonly kind: 'ok'
  /** ログインを始めるボタンの文言。どのサービスかの正は `docs/adr/0012-login.md`。 */
  readonly start: string
}

export const toLoginView = (): LoginView => ({ kind: 'ok', start: 'Discord で続ける' })

// ── アカウント作成（`docs/domain/group.md`「アカウントを作成する」）───────────

export type CreateAccountView =
  | { readonly kind: 'input'; readonly form: CreateAccountFields }
  | { readonly kind: 'invalid'; readonly form: CreateAccountFields; readonly message: string }
  | { readonly kind: 'created'; readonly form: CreateAccountFields; readonly redirectTo: string }

export type CreateAccountFields = {
  readonly name: string
  readonly nameLimits: TextFieldLimits
}

const createAccountFields = (name: string): CreateAccountFields => ({
  name,
  // **数値はドメイン層の定数から取る**（`docs/adr/0009`「クライアント側の入力検査」）。
  nameLimits: { maxLength: USER_NAME_MAX_LENGTH, required: true },
})

/**
 * 初期状態（`docs/adr/0009`「フォーム」：初期状態も Presenter が持つ）。
 *
 * **名前の入力欄は空から始まる。** 外部サービス側の名前を初期値に使わない
 * （`docs/domain/group.md`「アカウントを作成する」）。
 */
export const initialCreateAccountView = (): CreateAccountView => ({
  kind: 'input',
  form: createAccountFields(''),
})

/**
 * `notAuthenticated` が加わるのは、**入口の側でだけ起こり得る失敗**だからである。
 * 本人であることが確かめられていなければ、ユースケースを呼ぶための識別子が手に入らない
 * （`docs/adr/0012-login.md`）。ユースケース自身はセッションの存在を知らない（`docs/adr/0008`）。
 */
export const toCreateAccountView = (
  name: string,
  result: Result<User, CreateAccountError | { readonly kind: 'notAuthenticated' }>,
): CreateAccountView =>
  result.ok
    ? { kind: 'created', form: createAccountFields(result.value.name), redirectTo: route.groups() }
    : { kind: 'invalid', form: createAccountFields(name), message: messageOf(result.error) }

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

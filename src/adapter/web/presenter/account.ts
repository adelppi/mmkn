import { USER_NAME_MAX_LENGTH } from '../../../domain/group/text'
import type { User } from '../../../domain/group/user'
import type { Result } from '../../../domain/result'
import type { CreateAccountError } from '../../../usecase/account/create-account'
import type { RemoveLoginMethodError } from '../../../usecase/account/remove-login-method'
import type { ViewAccountError, ViewAccountOutput } from '../../../usecase/account/view-account'
import type { TextFieldLimits } from './form'
import { messageOf } from './message'
import { route } from './route'

/**
 * アカウントとログイン手段の表示（`docs/features.md` #11・#12）。
 *
 * **失敗はビューモデルのタグとして表す**（`docs/adr/0009-web-ui.md`「失敗の描画」）。
 * Container は成功と失敗で分岐せず、Presentational だけで失敗形も確認できる。
 *
 * **パスワードの入力欄も、再設定の導線もここに無い**（`docs/adr/0012-login.md`：
 * mmkn はパスワードを持たず、メールも送らない）。
 */

/** ログイン手段にできるサービスの表示名。**載っていないサービスは種別をそのまま出す。** */
const SERVICE_LABELS: Readonly<Record<string, string>> = {
  google: 'Google',
  discord: 'Discord',
}

const labelOf = (service: string): string => SERVICE_LABELS[service] ?? service

// ── ログイン（`docs/domain/group.md`「ログインする」）─────────────────────────

export type LoginChoiceView = {
  readonly service: string
  readonly label: string
  /** 「Google で続ける」。**サービスが増えても文面の作り方は変わらない。** */
  readonly action: string
}

export type LoginView = {
  readonly kind: 'ok'
  /**
   * 並べるログイン手段。**増やすときに画面を作り直さない**ため、画面はこの配列を回すだけにする
   * （何が並ぶかの正は `docs/adr/0012-login.md`）。
   */
  readonly choices: readonly LoginChoiceView[]
  readonly signUpHref: string
}

export const toLoginView = (services: readonly string[]): LoginView => ({
  kind: 'ok',
  choices: services.map((service) => ({
    service,
    label: labelOf(service),
    action: `${labelOf(service)} で続ける`,
  })),
  signUpHref: route.signUp(),
})

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

// ── ログイン手段の管理（`docs/domain/group.md`「User と外部アカウント」）──────

export type LoginMethodView = {
  readonly service: string
  readonly label: string
  readonly connected: boolean
  /**
   * その行の状態を表す一言。
   *
   * **外部サービス側のアカウント名は出さない。** mmkn は「このサービスのアカウントである」以上の
   * ことを保存していない（`docs/adr/0012-login.md`：アクセストークンも属性も保存しない）。
   */
  readonly status: string
}

export type AccountView =
  | {
      readonly kind: 'ok'
      readonly name: string
      /** 使えるサービスすべて。**追加済みと未追加が同じ並びに出る。** */
      readonly methods: readonly LoginMethodView[]
      /** **複数持つよう促す**（`docs/adr/0012-login.md`「留意点」）。 */
      readonly encouragement: string
      /** ログイン手段が 1 つしかない。促し方を強める。 */
      readonly atRisk: boolean
    }
  | { readonly kind: 'notAuthenticated'; readonly message: string; readonly loginHref: string }

const ENCOURAGEMENT =
  'ログイン手段は増やしておけます。ひとつ使えなくなっても、もうひとつから入れます。すべて失うと、このアカウントに戻る手段はありません。'

export const toAccountView = (
  available: readonly string[],
  result: Result<ViewAccountOutput, ViewAccountError>,
): AccountView => {
  if (!result.ok) {
    return {
      kind: 'notAuthenticated',
      message: messageOf(result.error),
      loginHref: route.login(),
    }
  }

  const connected = new Set(result.value.loginMethods.map((method) => method.service))

  return {
    kind: 'ok',
    name: result.value.user.name,
    methods: available.map((service) => ({
      service,
      label: labelOf(service),
      connected: connected.has(service),
      status: connected.has(service) ? 'ログインに使えます' : 'まだ使えません',
    })),
    encouragement: ENCOURAGEMENT,
    atRisk: result.value.loginMethods.length <= 1,
  }
}

/**
 * ログイン手段を削除した結果。
 *
 * **最後の 1 つを削除しようとした失敗も、ここにタグとして現れる**
 * （`docs/domain/group.md`「ログイン手段を削除する」）。**画面側では判定しない。**
 */
export type RemoveLoginMethodView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'removed'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string }

export const initialRemoveLoginMethodView = (): RemoveLoginMethodView => ({ kind: 'idle' })

export const toRemoveLoginMethodView = (
  service: string,
  result: Result<void, RemoveLoginMethodError>,
): RemoveLoginMethodView =>
  result.ok
    ? { kind: 'removed', message: `${labelOf(service)} でログインできなくなりました。` }
    : { kind: 'failed', message: messageOf(result.error) }

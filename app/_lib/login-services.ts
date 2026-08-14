import { LOGIN_SERVICES, type LoginService } from '@/src/infra/auth/external-account'

/**
 * ログイン手段にできる外部サービス（`docs/adr/0012-login.md`）。
 *
 * **正はインフラ側の宣言 1 か所**（`src/infra/auth/external-account.ts`）。ここはそれを
 * 画面まで運ぶだけで、一覧を持たない。**増やすときに触るのは向こうだけで、画面は変わらない。**
 */
export const loginServices = (): readonly LoginService[] =>
  Object.keys(LOGIN_SERVICES) as LoginService[]

export const isLoginService = (value: string): value is LoginService =>
  Object.hasOwn(LOGIN_SERVICES, value)

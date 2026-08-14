import type { APIInteraction } from 'discord-api-types/v10'
import type { ExternalAccount } from '../../domain/group/login-method'
import type { Place } from '../../domain/group/place-mapping'
import type { GroupId, UserId } from '../../domain/id'
import { err, ok, type Result } from '../../domain/result'
import type {
  ResolveActorError,
  ResolveActorInput,
  ResolveActorOutput,
} from '../../usecase/account/resolve-actor'
import type {
  ResolvePlaceError,
  ResolvePlaceInput,
  ResolvePlaceOutput,
} from '../../usecase/group/resolve-place'
import type { UseCase } from '../../usecase/usecase'
import { toNoAccountReply } from './presenter/group'
import { denied, type Reply } from './presenter/reply'

/**
 * 操作の主と対象の解決（`docs/adr/0006-discord-http-interactions.md`「対象 Group の解決」）。
 *
 * **外部 ID からアプリの ID への変換は入口で閉じる**（`docs/adr/0004-layers-and-dependencies.md`）。
 * ここから内側へ流れるのは `UserId` と `GroupId` だけで、Discord のユーザー ID もチャンネル ID も
 * ユースケースには渡らない。**ユースケースがチャンネルを知ることはない。**
 *
 * 解決できなかった 2 つの場合は、どちらも**案内を返して終わる**。記録は一切変わらない
 * （`docs/domain/group.md`「mmkn のアカウントを持たない人が…」「対応づけられていない場から…」）。
 *
 * **案内の可視性は、それが起きた defer の単位のもの**になる（`docs/adr/0006`「返信の可視性」）。
 * 公開として宣言した単位で解決に失敗すれば、案内も公開で返る。一律 deferred を保ったまま
 * 避ける方法は無く、これは ADR が受け入れた留意点である。
 */

/**
 * 場と外部アカウントのサービス種別（`docs/glossary.md` の `service`）。
 *
 * **ログイン手段の側で認証基盤が保存する値と一致している必要がある**（`docs/adr/0012-login.md`）。
 * 一致しなければ、Discord から届いた操作の主が誰も解決できなくなる。
 * 一致することの確認は `docs/operations.md`「実装着手時に必ず確かめること」にある。
 */
export const DISCORD_SERVICE = 'discord'

/** 1 つの Interaction について、入口が組み立てて渡すもの。 */
export type DiscordContext = {
  /** Interaction を送ってきた Discord のユーザー。 */
  readonly account: ExternalAccount
  /** Interaction が届いたチャンネル ＝ 場（`docs/domain/group.md`）。 */
  readonly place: Place
  /** 自分自身の URL。参加リンクと案内に使う（アダプタは実行環境を知らない）。 */
  readonly origin: string
  /**
   * 発生日の初期値。
   *
   * **初期値であって、日付そのものの意味を決めるものではない**（`docs/domain/record.md`「発生日」）。
   * Discord は操作した人の手元の日付を伝えないため、ここに入るのはサーバー側の日付になる。
   * 実際に記録されるのは、モーダルで確定した日付である。
   */
  readonly today: string
}

/** Interaction を送ってきた Discord のユーザーを、ログイン手段としての外部アカウントとして読む。 */
export const accountOf = (interaction: APIInteraction): ExternalAccount | undefined => {
  // ギルドでは `member.user`、DM では `user` に入る。
  const id = interaction.member?.user.id ?? interaction.user?.id
  if (id === undefined) return undefined

  return { service: DISCORD_SERVICE, id }
}

/** Interaction が届いたチャンネルを場として読む。 */
export const placeOf = (interaction: APIInteraction): Place | undefined => {
  const id = interaction.channel?.id
  if (id === undefined) return undefined

  return { service: DISCORD_SERVICE, id }
}

export type ContextUseCases = {
  readonly resolveActor: UseCase<ResolveActorInput, ResolveActorOutput, ResolveActorError>
  readonly resolvePlace: UseCase<ResolvePlaceInput, ResolvePlaceOutput, ResolvePlaceError>
}

/**
 * 操作の主を解決する。
 *
 * **ログイン手段の参照を通す**（`docs/adr/0012-login.md`）。認証基盤のスキーマを直接読まない。
 * **未連携という状態は無い。** あるのは「mmkn のアカウントをまだ持っていない」だけである。
 */
export const resolveActor = async (
  usecases: ContextUseCases,
  context: DiscordContext,
): Promise<Result<UserId, Reply>> => {
  const resolved = await usecases.resolveActor({ account: context.account })
  if (!resolved.ok) return err(toNoAccountReply(context.origin))

  return ok(resolved.value.actor)
}

/**
 * 操作の対象になる Group を解決する。
 *
 * **解決はアダプタ層で行い、ユースケースには Group を渡す**（`docs/adr/0004`）。
 */
export const resolveGroup = async (
  usecases: ContextUseCases,
  context: DiscordContext,
): Promise<Result<GroupId, Reply>> => {
  const resolved = await usecases.resolvePlace({ place: context.place })
  if (!resolved.ok) return err(denied(resolved.error))

  return ok(resolved.value.group)
}

/** 主と対象の両方を要する操作のための、まとめた解決。 */
export const resolveTarget = async (
  usecases: ContextUseCases,
  context: DiscordContext,
): Promise<Result<{ actor: UserId; group: GroupId }, Reply>> => {
  const actor = await resolveActor(usecases, context)
  if (!actor.ok) return actor

  const group = await resolveGroup(usecases, context)
  if (!group.ok) return group

  return ok({ actor: actor.value, group: group.value })
}

import type { User } from '@/src/domain/group/user'
import { idEquals } from '@/src/domain/id'
import type { GroupRepository } from '@/src/usecase/port/group-repository'
import type { PaymentRepository } from '@/src/usecase/port/payment-repository'
import type { TransferRepository } from '@/src/usecase/port/transfer-repository'
import type { UserRepository } from '@/src/usecase/port/user-repository'

/**
 * 取得を束ねる（`docs/adr/0009-web-ui.md`「束ねる位置」「束ねるのは読み取りだけの経路に限る」）。
 *
 * **書き込みは包まない。** 束ねるかどうかは `wire()` の呼び出し側が決め、既定は束ねない（`noBundling`）。
 */

/**
 * 取得を束ねる合図。渡された読み取りを、**同じ引数なら 1 回で済む形**に包んで返す。
 *
 * Container は並んで走るため、**結果ではなく、走り始めた取得そのものを使い回す**必要がある。
 */
export type BundleReads = <A extends unknown[], R>(
  read: (...args: A) => Promise<R>,
) => (...args: A) => Promise<R>

/** 既定。**束ねない。** 外し忘れても失敗しないため、安全な側に倒す。 */
export const noBundling: BundleReads = (read) => read

/** 操作する User を得る手段。ログインしているかを確かめるために、既に読まれている。 */
export type Viewer = () => Promise<User | undefined>

/** 合成ルートに渡すもの。**`viewer` は束ねる合図と一緒にしか立たない。** */
export type Reads = { readonly bundle: BundleReads; readonly viewer?: Viewer }

export const unbundled: Reads = { bundle: noBundling }

/*
 * 以下、リポジトリごとに**読み取りだけ**を包む。
 * 書き込み（`create`・`update`・`remove`・`save*`・`add*`）はそのまま通す。
 * **ポートに読み取りを足したら、ここにも足す。** 足し忘れは束ならないだけで、壊れはしない。
 * `listByGroups` は足していない。引数が配列で、`cache()` は参照で見分けるため束ならない。
 */

export const bundledGroups = (
  repository: GroupRepository,
  bundle: BundleReads,
): GroupRepository => ({
  ...repository,
  findById: bundle(repository.findById),
  findByInviteCode: bundle(repository.findByInviteCode),
  listByUser: bundle(repository.listByUser),
})

/**
 * **操作する User だけは、`viewer` が既に読んだものを返す。** 違う人を求められたら読みに行く。
 * 無ければ束ねるだけになる。
 */
export const bundledUsers = (
  repository: UserRepository,
  bundle: BundleReads,
  viewer?: Viewer,
): UserRepository => {
  const findById = bundle(repository.findById)

  return {
    ...repository,
    findById: async (id) => {
      const known = await viewer?.()
      return known !== undefined && idEquals(known.id, id) ? known : findById(id)
    },
    findByLoginIdentifier: bundle(repository.findByLoginIdentifier),
  }
}

export const bundledPayments = (
  repository: PaymentRepository,
  bundle: BundleReads,
): PaymentRepository => ({
  ...repository,
  find: bundle(repository.find),
  listByGroup: bundle(repository.listByGroup),
})

export const bundledTransfers = (
  repository: TransferRepository,
  bundle: BundleReads,
): TransferRepository => ({
  ...repository,
  find: bundle(repository.find),
  listByGroup: bundle(repository.listByGroup),
})

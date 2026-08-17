import type { ExternalAccountRepository } from '@/src/usecase/port/external-account-repository'
import type { GroupRepository } from '@/src/usecase/port/group-repository'
import type { PaymentRepository } from '@/src/usecase/port/payment-repository'
import type { PlaceMappingRepository } from '@/src/usecase/port/place-mapping-repository'
import type { TransferRepository } from '@/src/usecase/port/transfer-repository'
import type { UserRepository } from '@/src/usecase/port/user-repository'

/**
 * 取得を束ねる（`docs/adr/0009-web-ui.md`「束ねる位置」「束ねるのは読み取りだけの経路に限る」）。
 *
 * **束ねるのはユースケースの外側ではなく、その内側の取得そのものである。** ユースケースの単位で
 * 束ねても、別々のユースケースが同じものを読む重複は残る（上端も記録の一覧も収支も、どれも
 * グループを読む）。ここが包むのはリポジトリの読み取りで、**合成ルートが組み立てるときに被せる**
 * （`docs/adr/0008-layer-internals.md`「合成ルート」）。
 *
 * **書き込みは包まない。** 書き込みの直前の読み直しが古い値を返すと、同じ記録に同時に手が
 * 入ったことの検出が**失敗しないまま**成立しなくなる（`docs/domain/record.md`「同じ記録に
 * 同時に手が入ったとき」・`docs/adr/0005-data-access-and-authorization.md`「同時書き込みの競合」）。
 * 経路ごと束ねるかどうかは `wire()` の呼び出し側が決め、**既定は束ねない**（`noBundling`）。
 */

/**
 * 取得を束ねる合図。渡された読み取りを、**同じ引数なら 1 回で済む形**に包んで返す。
 *
 * **包み方をここに持たない。** 1 リクエストの中で閉じる仕組み（React の `cache()`）は
 * フレームワークのものであり、`src/**` から React を参照しない（`.dependency-cruiser.cjs`）。
 * 合成ルートに渡す形にしてあるのはそのためで、渡すのは `app/_lib/read.ts` だけである。
 *
 * **同時に呼ばれたときも 1 回で済む形であること。** 記録・収支・清算案の Container は並んで走る
 * （`docs/adr/0009-web-ui.md`「Container の粒度」）ため、結果ではなく走り始めた取得そのものを
 * 使い回せないと束ならない。
 */
export type BundleReads = <A extends unknown[], R>(
  read: (...args: A) => Promise<R>,
) => (...args: A) => Promise<R>

/**
 * 既定。**束ねない。**
 *
 * 「読み取りだけの経路が明示的に立てる」形にしてあるのは、外し忘れたときに壊れるのが
 * 競合の検出であり、**失敗しないため表に出ない**ためである
 * （`docs/adr/0009-web-ui.md`「検討した代替案」）。既定は安全な側に倒す。
 */
export const noBundling: BundleReads = (read) => read

/*
 * 以下、リポジトリごとに**読み取りだけ**を包む。
 * 書き込み（`create`・`update`・`remove`・`save*`・`add*`）はそのまま通す。
 * **ポートに読み取りを足したら、ここにも足す。** 足し忘れは束ならないだけで、壊れはしない。
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

export const bundledUsers = (repository: UserRepository, bundle: BundleReads): UserRepository => ({
  ...repository,
  findById: bundle(repository.findById),
  findByLoginIdentifier: bundle(repository.findByLoginIdentifier),
})

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

/**
 * 場の対応。**引数が素の値ではないため、同じ場を指していても別の呼び出しとして扱われ得る。**
 * 束ならないだけで結果は変わらない（`find` は読み取りのみ）。
 */
export const bundledPlaceMappings = (
  repository: PlaceMappingRepository,
  bundle: BundleReads,
): PlaceMappingRepository => ({
  ...repository,
  find: bundle(repository.find),
})

/** 同上。`findUserId` は外部アカウント（オブジェクト）を受け取る。 */
export const bundledExternalAccounts = (
  repository: ExternalAccountRepository,
  bundle: BundleReads,
): ExternalAccountRepository => ({
  ...repository,
  findUserId: bundle(repository.findUserId),
  listByUser: bundle(repository.listByUser),
})

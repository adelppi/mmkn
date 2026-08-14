'use client'

import Link from 'next/link'
import { ChevronLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useActionState } from 'react'

import { Button } from '@/app/_ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/_ui/dialog'
import { Row } from '@/app/_ui/field'
import { Money } from '@/app/_ui/money'
import { AppBar, Empty, Notice, Screen } from '@/app/_ui/notice'
import { useUnreachableGuard } from '@/app/_ui/toast'
import type { FormAction } from '@/src/adapter/web/presenter/form'
import type { NoticeView } from '@/src/adapter/web/presenter/notice'
import type { RecordDetailView, RecordFormView } from '@/src/adapter/web/presenter/record'

/**
 * 記録の詳細（設計 08）。
 *
 * **負担額は保存されていない**（`docs/domain/record.md`「負担額の配分」）。届くのは
 * そのつど導出された配分である。
 *
 * **削除は復元できない。** そのことを確認の文面で伝え、取り消しの導線は持たない。
 */
export function RecordDetailPresentation(
  props: RecordDetailView & {
    readonly deleteAction: FormAction<RecordFormView>
    readonly deleteInitial: RecordFormView
    readonly editHref: string
    readonly unreachable: NoticeView
  },
) {
  const guarded = useUnreachableGuard(props.deleteAction, props.unreachable)
  const [deleted, remove, pending] = useActionState(guarded, props.deleteInitial)

  if (props.kind !== 'ok') {
    return (
      <Screen>
        <AppBar>記録の詳細</AppBar>
        <Empty>
          <Notice>{props.message}</Notice>
          <Button asChild variant="outline" className="font-normal">
            <Link href={props.groupsHref}>グループ一覧へ</Link>
          </Button>
        </Empty>
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar>
        <Link href={props.groupHref} className="flex min-w-0 items-center gap-2">
          <ChevronLeftIcon className="size-4.5 shrink-0 text-subtle" />
          <span className="truncate">{props.title}</span>
        </Link>
        <Link href={props.editHref} className="shrink-0 text-muted-foreground">
          <PencilIcon className="size-4" />
          <span className="sr-only">編集</span>
        </Link>
      </AppBar>

      <div className="flex flex-1 flex-col gap-6 p-4">
        <div className="flex items-baseline justify-between rounded-lg bg-muted p-4">
          <span className="tabular text-sm tracking-[0.08em] text-muted-foreground">
            {props.currency}
          </span>
          <Money {...props.money} className="text-xl" />
        </div>

        <div className="flex flex-col">
          {props.transferNames === undefined ? (
            <>
              <Row label="内容">{props.description === '' ? '（内容なし）' : props.description}</Row>
              <Row label="支払った人">{props.payerName}</Row>
            </>
          ) : (
            <>
              <Row label="送った人">{props.transferNames.sender}</Row>
              <Row label="受け取った人">{props.transferNames.recipient}</Row>
            </>
          )}
          <Row label="発生日">
            <span className="tabular">{props.occurredOn}</span>
          </Row>
          <Row label="登録した人">{props.recordedBy}</Row>
        </div>

        {props.shares.length === 0 ? null : (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs text-subtle">
              負担する人　<span className="tabular">{props.shares.length}</span> 人
            </h2>
            <ul className="rounded-lg border border-border">
              {props.shares.map((share) => (
                <li
                  key={share.displayName + share.money.digits}
                  className="flex items-baseline justify-between gap-3 border-b border-border/70 px-4 py-2.5 text-sm last:border-b-0"
                >
                  <span className="truncate">{share.displayName}</span>
                  <Money {...share.money} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {deleted.kind === 'conflict' ? (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive-border p-4">
            <Notice tone="error">{deleted.message}</Notice>
            <Button asChild variant="outline" size="sm" className="self-start font-normal">
              <Link href={deleted.reloadHref}>最新を読み込む</Link>
            </Button>
          </div>
        ) : null}
        {deleted.kind === 'denied' || deleted.kind === 'invalid' ? (
          <Notice tone="error">{deleted.message}</Notice>
        ) : null}

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="mt-auto font-normal text-destructive">
              <Trash2Icon />
              削除する
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>この記録を削除しますか</DialogTitle>
              <DialogDescription>削除すると元に戻せません。</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="flex-1 font-normal">
                  やめる
                </Button>
              </DialogClose>
              <form action={remove} className="flex-1">
                <input type="hidden" name="type" value={props.form.type} readOnly />
                <input type="hidden" name="groupId" value={props.form.groupId} readOnly />
                <input type="hidden" name="recordId" value={props.form.recordId} readOnly />
                <input type="hidden" name="version" value={props.form.version} readOnly />
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={pending}
                  className="w-full font-normal"
                >
                  削除する
                </Button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Screen>
  )
}

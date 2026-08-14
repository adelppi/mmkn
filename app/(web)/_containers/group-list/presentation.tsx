import Link from 'next/link'

import { Button } from '@/app/_ui/button'
import { Money } from '@/app/_ui/money'
import { AppBar, Empty, Notice, Screen } from '@/app/_ui/notice'
import type { GroupListView } from '@/src/adapter/web/presenter/group'

/**
 * グループ一覧（設計 02）。
 *
 * **props はビューモデルそのもの**（`docs/adr/0009-web-ui.md`）。
 * **失敗もここで描く。** Container は成功と失敗で分岐しない。
 *
 * 並ぶ収支は**自分の分だけ**である（`src/usecase/group/list-groups.ts`）。
 */
export function GroupListPresentation(props: GroupListView) {
  if (props.kind === 'notAuthenticated') {
    return (
      <Screen>
        <AppBar>
          <span className="tabular tracking-[0.2em]">mmkn</span>
        </AppBar>
        <Empty>
          <Notice>{props.message}</Notice>
          <Button asChild variant="outline" className="font-normal">
            <Link href={props.loginHref}>ログインする</Link>
          </Button>
        </Empty>
      </Screen>
    )
  }

  return (
    <Screen>
      <AppBar>
        <span className="tabular tracking-[0.2em]">mmkn</span>
        <Link href={props.accountHref} className="text-muted-foreground">
          アカウント
        </Link>
      </AppBar>

      {props.kind === 'empty' ? (
        <Empty>
          まだグループがありません。
          <br />
          作るか、招待リンクから参加すると、ここに並びます。
        </Empty>
      ) : (
        <ul className="flex flex-1 flex-col gap-3 p-4">
          {props.groups.map((group) => (
            <li key={group.id}>
              <Link
                href={group.href}
                className="flex flex-col gap-3.5 rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{group.name}</span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                    <span className="tabular">{group.memberCount}</span> 人
                  </span>
                </div>

                {group.balances.length === 0 ? (
                  <span className="text-sm text-subtle">収支なし</span>
                ) : (
                  <div className="flex flex-col gap-2">
                    {group.balances.map((balance) => (
                      <div
                        key={`${balance.label}${balance.money.symbol}`}
                        className="flex items-baseline justify-between"
                      >
                        <span className="text-sm text-muted-foreground">{balance.label}</span>
                        <Money {...balance.money} />
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="p-4 pb-7">
        <Button asChild className="h-11 w-full font-normal">
          <Link href={props.newGroupHref}>グループを作成</Link>
        </Button>
      </div>
    </Screen>
  )
}

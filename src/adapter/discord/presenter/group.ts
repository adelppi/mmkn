import type { Group } from '../../../domain/group/group'
import type { ListGroupsOutput } from '../../../usecase/group/list-groups'
import { currencyNameOf } from '../../shared/money'
import { inviteUrl } from '../../shared/invite'
import { COMMAND_NAME, customId } from '../definitions'
import { button, buttonRows, done, field, notice, select, selectRow, choice, type Reply } from './reply'

/**
 * グループについての表示（`docs/features.md` #1・#13）。
 *
 * **参加コードを裸で出さない**（`docs/domain/group.md`「Group の属性」）。渡すのは共有リンクの形で、
 * その返信は実行者のみに見える単位で返る（`definitions.ts` の `modals['create-group']`）。
 */

/**
 * グループを作った直後の返信。
 *
 * **対応づけは参加ではなく、作成とも別の操作である**（`docs/domain/group.md`）。
 * そのため作成が自動でチャンネルに対応づけることはせず、次の操作をボタンとして添える。
 */
export const toCreatedGroupReply = (group: Group, origin: string): Reply =>
  done({
    title: 'グループを作りました',
    fields: [
      field('名前', group.name),
      field('既定通貨', `${group.defaultCurrency} — ${currencyNameOf(group.defaultCurrency)}`),
      field('参加リンク', inviteUrl(origin, group.inviteCode)),
    ],
    components: buttonRows([
      button({
        customId: customId('assign', group.id),
        label: 'このチャンネルに対応づける',
        primary: true,
      }),
    ]),
  })

/**
 * どのグループをこのチャンネルに対応づけるかを選ばせる。
 *
 * **選び終えた時点で確定する**（`docs/adr/0006-discord-http-interactions.md`「ユーザー選択 UI」）。
 * 確定用のボタンをセレクトと別に置かない。置くと選択値をボタンの押下まで運ぶことになる。
 */
export const toGroupChoicesReply = (output: ListGroupsOutput): Reply => {
  if (output.groups.length === 0) {
    return notice(
      '対応づけられるグループがありません',
      'まだどのグループにも参加していません。`/mmkn create` で作るか、共有された参加リンクから参加してください。',
    )
  }

  return {
    embeds: [],
    components: [
      selectRow(
        select({
          customId: customId('pick-group'),
          placeholder: 'このチャンネルに対応づけるグループを選ぶ',
          options: output.groups.map(({ group }) => choice(group.id, group.name)),
        }),
      ),
    ],
  }
}

/**
 * 対応づけられたことを伝える。
 *
 * **名前は対応づけたあとに読み直したものを出す。** 選択肢に書いてあった名前は使わない
 * （`docs/adr/0006`「メッセージに埋めた値を信じない」）。
 */
export const toAssignedReply = (group: Group): Reply =>
  done({
    title: 'このチャンネルに対応づけました',
    description: `以後、このチャンネルの \`/${COMMAND_NAME}\` の操作は **${group.name}** に向きます。`,
    // **部品を空で明示的に送る。** 対応づけは済んだため、同じボタンを押せる状態を残さない。
    components: [],
  })

export const toReleasedReply = (): Reply =>
  done({
    title: 'このチャンネルの対応づけを解除しました',
    description:
      'グループ自体は消えていません。Web からも、対応づけた別のチャンネルからも、これまでどおり操作できます。',
    components: [],
  })

/**
 * mmkn のアカウントをまだ持っていない人への案内
 * （`docs/domain/group.md`「mmkn のアカウントを持たない人が、外部サービスから操作したとき」）。
 *
 * **User は作られず、記録も一切変わらない。** ここでできるのは案内までである。
 */
export const toNoAccountReply = (origin: string): Reply =>
  notice(
    'mmkn のアカウントが必要です',
    [
      'この操作をするには mmkn のアカウントが要ります。**いま使っている Discord のアカウントでそのまま作れます。**',
      '',
      origin,
    ].join('\n'),
  )

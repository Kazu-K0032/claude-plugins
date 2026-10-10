import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Register, ToolCallInput } from 'claude-code'

import { hasEmphasis, parse } from './emphasis'
import type { Block, Span, Tone } from './emphasis'
import { isReadOnlyCommand, isReadOnlyMcpTool, isReadOnlyTool } from './readonly'
import { nextClaudeRequest } from './sections'

/** 強調に使う色。テーマのキーか生の色名 */
const EMPHASIS_COLOR = 'red'

/** 行頭の印ごとの見た目 */
const TONE_STYLES: Record<Tone, { color: string; bold: boolean }> = {
  conclusion: { color: EMPHASIS_COLOR, bold: true },
  caution: { color: EMPHASIS_COLOR, bold: false },
}

/** Markdown 要素が一度に描ける文字数の上限（MarkdownProps.text） */
const MARKDOWN_MAX_LENGTH = 10000

/** 技術的な仕様（{{仕様}}）の色。赤の強調と `コード` の色（permission）から見分けられる緑 */
const SPEC_COLOR = '#22c55e'

/** 文中の `コード` の色。engine が応答を描くときと同じテーマのキー */
const CODE_COLOR = 'permission'

/** 応答のカスタマイズの on/off を次のセッションへ持ち越すための $.store のキー */
const CUSTOMIZED_STORE_KEY = 'isCustomized'

/** 文書の書き方の指定の on/off を次のセッションへ持ち越すための $.store のキー */
const DOC_CONCISE_STORE_KEY = 'isDocConcise'

/** チャットモード中に、画面下のモード表示へ足す文字 */
const CHAT_MODE_LABEL = 'チャット'

/**
 * チャットモード（読み取り専用）か。セッションをまたいで持ち越さない
 * （気づかないまま次のセッションや -p の実行で書き込みが拒否されないように）
 */
const isChatMode = atom({ plugin: 'mod-output-customize', key: 'isChatMode' } as const, false)

/** 応答を mod の形式（簡潔版・概要の見出しと色分けの記法）で書かせるか */
const isCustomized = atom({ plugin: 'mod-output-customize', key: 'isCustomized' } as const, true)

/** Issue・PR の本文やコメントなど、外に書き出す文書を簡潔に書かせるか */
const isDocConcise = atom({ plugin: 'mod-output-customize', key: 'isDocConcise' } as const, true)

/**
 * 最新の応答の次アクションにあった、Claude ができる作業の依頼文。無ければ空文字。
 * エンジン自身の入力欄の候補が後から来たときに、この文に差し替えるために持っておく
 */
const nextSuggestion = atom({ plugin: 'mod-output-customize', key: 'nextSuggestion' } as const, '')

/**
 * ボタン 1 つ分。サイドバーか入力欄の上に出し、クリックでだけ押す
 * 数字キー（hotkey）を割り当てると、空の入力欄で数字を打っただけで on/off が切り替わってしまうため、割り当てない
 */
type Toggle = {
  key: string
  label: string
  onColor: string
}

/** ボタン 1 つ分の今の状態と、押したときに on/off を入れ替える処理 */
type ToggleState = {
  toggle: Toggle
  isOn: boolean
  onPress: () => Promise<void>
}

/** ボタンを並べるサイドバー（Pane）の id。コマンドで開き直すときも同じ id を使う */
const PANE_ID = 'output-customize'

/** サイドバーの題。ほかの mod のサイドバーと並んだときのタブに出る */
const PANE_TITLE = '出力の設定'

/** サイドバーの幅（本文の桁数）。いちばん長い「チャットモード OFF」が 1 行に収まる幅 */
const PANE_COLUMNS = 22

/** 閉じたサイドバーを開き直すコマンドの名前 */
const PANE_COMMAND = 'output-customize'

/** チャットモードを切り替えるボタン */
const CHAT_MODE_TOGGLE: Toggle = {
  key: 'toggle-chat-mode',
  label: 'チャットモード',
  onColor: 'warning',
}

/** 応答のカスタマイズを切り替えるボタン */
const CUSTOMIZED_TOGGLE: Toggle = {
  key: 'toggle-customized',
  label: '応答カスタム',
  onColor: EMPHASIS_COLOR,
}

/** 文書の書き方の指定を切り替えるボタン */
const DOC_CONCISE_TOGGLE: Toggle = {
  key: 'toggle-doc-concise',
  label: '文書を簡潔に',
  onColor: 'suggestion',
}

/** チャットモードで、読み取り用でないツール（ファイルの編集・PowerShell など）を止めたとき、モデルに返す理由 */
const TOOL_DENY_REASON = [
  'チャットモード（読み取り専用）のため、このツールは使えません。',
  '使えるのは Read・Glob・Grep・WebFetch・WebSearch などの読み取り用のツールだけです。',
  '変更内容は提案にとどめ、変更が必要ならユーザーにチャットモードを OFF にしてもらってください。',
].join('')

/** チャットモードの判定が失敗したとき、読み取り用でないツールを止める理由 */
const CHECK_FAILED_DENY_REASON =
  'チャットモードかどうかを確かめられなかったため、安全のためこのツールを止めました。もう一度試してください。'

/** チャットモードで Bash のコマンドを止めたとき、モデルに返す理由 */
const BASH_DENY_REASON = [
  'チャットモード（読み取り専用）のため、このコマンドは実行できません。',
  '使えるのは ls・cat・head・tail・grep・rg・find・wc・git status/log/diff/show・gh pr view/list/diff・gh issue view/list・gh api（GET）などの読み取り用コマンドだけで、',
  'ファイルへの書き出し（> や >>）、$(...)、sed・awk・xargs などは使えません。ファイルの中身は Read ツールで読んでください。',
].join('')

/** チャットモードで MCP ツールを止めたとき、モデルに返す理由 */
const MCP_DENY_REASON = [
  'チャットモード（読み取り専用）のため、この MCP ツールは実行できません。',
  '名前に search・get・list・read・fetch・query などの読み取りの語を含み、create・update・send などの書き込みの語を含まないツールだけが使えます。',
].join('')

/**
 * 前のセッションで保存した、応答のカスタマイズと文書の書き方の指定の on/off を $.state に読み込む
 * @param $ - フックが受け取った engine のインターフェース
 */
async function loadSavedToggles($: Pick<CoreEngineInterface, 'state' | 'store'>): Promise<void> {
  const [savedCustomized, savedDocConcise] = await Promise.all([
    $.store.get(CUSTOMIZED_STORE_KEY),
    $.store.get(DOC_CONCISE_STORE_KEY),
  ])
  await update($, isCustomized, () => savedCustomized !== false)
  await update($, isDocConcise, () => savedDocConcise !== false)
}

/**
 * on/off のボタンの今の状態と、押したときの処理を読む。サイドバーと入力欄の上の帯で同じものを使う
 * @param $ - フックが受け取った engine のインターフェース
 * @returns チャットモード・応答カスタム・文書を簡潔にの順の状態
 */
async function readToggleStates($: Pick<CoreEngineInterface, 'state' | 'store'>): Promise<ToggleState[]> {
  const [chatMode, customized, docConcise] = await Promise.all([
    read($, isChatMode),
    read($, isCustomized),
    read($, isDocConcise),
  ])

  return [
    {
      toggle: CHAT_MODE_TOGGLE,
      isOn: chatMode,
      onPress: async () => {
        await update($, isChatMode, isOnNow => !isOnNow)
      },
    },
    {
      toggle: CUSTOMIZED_TOGGLE,
      isOn: customized,
      onPress: async () => {
        const value = await update($, isCustomized, isOnNow => !isOnNow)
        await $.store.set(CUSTOMIZED_STORE_KEY, value)
      },
    },
    {
      toggle: DOC_CONCISE_TOGGLE,
      isOn: docConcise,
      onPress: async () => {
        const value = await update($, isDocConcise, isOnNow => !isOnNow)
        await $.store.set(DOC_CONCISE_STORE_KEY, value)
      },
    },
  ]
}

/**
 * ボタンのサイドバーを開き、入力欄の上の帯を描き直す（サイドバーに置けたら帯を消すため）
 * @param $ - フックが受け取った engine のインターフェース
 */
async function openPane($: Pick<CoreEngineInterface, 'ui'>): Promise<void> {
  await $.ui.open({ id: PANE_ID, title: PANE_TITLE, columns: PANE_COLUMNS })
  $.ui.invalidate('ui.render')
}

/**
 * ボタンのサイドバーが今描かれているか。調べられなければ描かれていないとみなし、帯にボタンを出す
 * @param $ - フックが受け取った engine のインターフェース
 * @returns 描かれていれば true
 */
async function isPanePlaced($: Pick<CoreEngineInterface, 'ui'>): Promise<boolean> {
  try {
    const panes = await $.ui.panes()
    return panes.some(pane => pane.id === PANE_ID && pane.isPlaced)
  } catch {
    return false
  }
}

/**
 * モデルに応答の形式と記法を教える文。プロンプトごとに、ユーザーには見えない文脈として添える
 */
const GUIDE_TEXT = [
  '# 応答の形式',
  '説明・調査結果・作業報告など内容のある応答は、次の見出しをこの順で置いて書く。',
  '1. `### 簡潔版`: 200〜300 文字。非エンジニアでも伝わるよう、専門用語やコードの名前を避け、何が起きたか・何をしたか・どうなったかを平易な言葉で書く',
  '2. `### 概要`: ここからはエンジニア向け。ファイル・コード・設計判断などの具体的な説明を書く',
  '3. `## 次アクション`: 必要なときだけ、応答の最後に置く。ユーザーがすること（コマンドの実行・判断・確認）や、続けて Claude ができる作業があるときに、誰が何をするかを 1 行ずつ、1〜3 項目の箇条書きで書く。各項目は「あなた：」か「Claude：」で始め、Claude の項目は「〜して」の形で、そのまま依頼として送れる文にする。選んでもらう選択肢もここに置く。することが無ければ置かない。ほかの部分と同じ内容を繰り返さない',
  '応答全体が 300 文字に満たない短い返答（一言で済む回答、確認の問いかけなど）では、`### 簡潔版` と `### 概要` を付けない。`## 次アクション` は短い返答でも、必要なら置く。',
  '文と文のつながりは、接続詞で読み手に示す。理由は「なぜなら、〜からだ」、言い換えやまとめは「つまり、〜」で書き、「〇〇が〇〇するのは、〜だから」のように、何が何をするのかをはっきりさせる。簡潔版でも同じにする。',
  'この形式は、出力スタイルが定める行数や見出しの目安より優先する。',
  '',
  '# 応答の色分け',
  'チャットの応答本文では、次の記法で箇所に色を付ける。端末では赤や緑で表示される。',
  '- 結論・まとめの文: 行頭を「✅ 」で始める（赤の太字。1 応答に 1〜2 行まで）',
  '- 禁止事項・注意点: 行頭を「❌ 【分類】」で始め、文末に「（例：…）」で具体例を 1 つ添える（赤。分類のラベルは太字）。分類は次のどれか:',
  '  - 【禁止】: してはいけないこと（データを壊す・取り返しがつかない・規約に反する操作など）',
  '  - 【警告】: まだやっていないこと、注意すべきこと（未実施の作業、誤解しやすい挙動など）',
  '  - 【未確認】: 検証していないこと（テストを実行していない、実際の画面や環境で試していないなど）',
  '  - 【制限】: 仕組み上できないこと、対応範囲の外のこと',
  '  変更による副作用やほかの機能への影響は ❌ で書かず、本文の普通の文で書く。',
  '  例には、できない操作・起きてしまう失敗・勘違いしやすい場面など、その注意を一番思い浮かべやすいものを選ぶ。書き方の例: ❌ 【禁止】パスワードを書いたファイルをコミットしない（例：コミット後に消しても履歴に残る）',
  '- 本文中の重要な箇所: `==語句==` で囲む（赤の太字）。✅ / ❌ の行に限らず、普通の文や箇条書きの中でも、読み手が見落とすと困る点（判断に関わる事実・注意点・結果の数値など）を囲む。1 応答に 1〜3 か所、1 か所は 20 文字程度までの語句か短い句にする',
  '- 技術的な仕様: `{{仕様}}` で囲む（緑）。技術的な仕様を説明するときだけ、仕様そのものにあたる部分（挙動・制約・既定値・上限・対応範囲など）を囲む。同じ仕様は 1 回だけ、1 応答に 5 か所まで、1 か所は 30 文字程度までにする',
  '赤と緑が重なる箇所は赤だけにする。`==` や `{{ }}` の中に `コード` を入れない（記法が表示されてしまう）。',
  '✅ / ❌ の行は 1 文・40 文字程度（❌ の行は【分類】と（例：…）を除いて）に収め、要点だけを分かりやすい言葉で書く。例は 30 文字程度までにする。理由や細部はその行に詰め込まず、続く本文に回す。',
  '✅ / ❌ は意味を持つ印であり、装飾目的の絵文字には当たらない。色を付けた箇所が多いとかえって読みにくく、強調も効かなくなるので、上の回数を超えない。迷ったら付けない。',
  'この記法はチャットの応答本文だけで使う。ファイル・コード・コミットメッセージ・PR・Issue・コメントなど、外へ書き出すテキストには使わない。',
].join('\n')

/**
 * 応答のカスタマイズが OFF のときに添える文。それまでの応答が mod の形式でも、今回は使わせない
 */
const PLAIN_TEXT = [
  '# 応答の形式',
  'このプロンプトへの応答では、「### 簡潔版」「### 概要」「## 次アクション」の見出しと、✅ / ❌ / ==語句== / {{仕様}} の記法を使わない。',
  'これまでの応答で使っていても、今回は通常の形式で書く。',
].join('\n')

/** 文書の書き方の指定が ON のときに添える文 */
const DOC_CONCISE_TEXT = [
  '# 文書の書き方',
  'Issue・PR・Discussion の本文やコメント、レビューコメント、リポジトリ内の文書（README・docs・ADR など）、Notion・Slack・メールなど外部サービスへの投稿を書くときは、次の書き方にする。新しく書くときも、既存の文書を更新するときも同じ。コミットメッセージとコード内のコメントは対象外。',
  '- 一番大事なのは文字数を少なくすること。長い文章は読み手の集中力を下げる。書き終えたら、削っても意味が変わらない語や文がないか見直して削る',
  '- 難しい言葉・専門用語・カタカナ語はできるだけ使わず、誰が読んでも分かる言葉で書く。専門用語が避けられないときは、初めて出すときに短い言い換えを添える',
  '- 冒頭の 1〜2 文で、目的か結論（何をするか・何が起きたか、なぜか）を書く',
  '- 1 文は 40 文字程度までにし、1 文に 1 つの事柄だけを書く。箇条書きと短い見出しで区切る。コメントは 1〜3 文を目安にする',
  '- 読み手が判断や作業をするのに必要なことだけを書く。調べた経緯、同じ内容の繰り返し、前置きやあいさつは書かない',
  '- 「いい感じに」「適宜」のようなあいまいな語を避け、数値・ファイル名・手順で具体的に書く',
  '- 既存の文書を更新するときは、足す・直す部分をこの書き方にする。書き足すより書き換えを優先し、変更で古くなった記述や重複は消す。頼まれていない部分は書き直さない',
  '- リポジトリにテンプレート（.github/PULL_REQUEST_TEMPLATE.md など）や文書の規約があれば、そちらを優先する',
  '- チャット用の形式（「### 簡潔版」「### 概要」の見出し、✅ / ❌ / ==語句== / {{仕様}} の記法）は使わない',
].join('\n')

/**
 * 文書の書き方の指定が OFF のときに添える文。それまでのプロンプトで指定していても、今回は解除する
 */
const DOC_PLAIN_TEXT = [
  '# 文書の書き方',
  '文書（Issue・PR の本文やコメント、リポジトリ内の文書など）の書き方の指定は解除した。これまでのプロンプトでの指定に関係なく、通常どおりに書く。',
].join('\n')

/** チャットモードのときに添える文 */
const CHAT_MODE_TEXT = [
  '# チャットモード（読み取り専用）',
  'いまはチャットモード。質問への回答と、ファイルを読む・検索するといった調査だけを行う。',
  '- ファイルの作成・編集・削除、コミットやプッシュ、パッケージのインストールなど、状態を変える操作はしない',
  '- 外部サービスへの送信・作成・更新もしない。GitHub は gh の読み取り用コマンド（pr view/list/diff、issue view/list、api の GET など）で読む',
  '- 使えるのは、Read・Glob・Grep・WebFetch・WebSearch などの読み取り用のツール、読み取り用の Bash コマンド、名前から読み取り専用と判断できる MCP ツールだけ。ほかのツール（Edit・Write・PowerShell など）は拒否される',
  '変更が必要なときは変更案を示し、「チャットモード」ボタン（サイドバーか入力欄の上）で OFF にするようユーザーに伝える。',
].join('\n')

/**
 * チャットモードでツールを止める理由を返す。読み取り用だけを通す許可リスト方式で、知らないツールは止める
 * @param e - tool.call の入力
 * @returns 止めるなら理由、通すなら null
 */
function chatModeDenyReason(e: ToolCallInput): string | null {
  if (e.tool === 'Bash') {
    return isReadOnlyCommand(e.command) ? null : BASH_DENY_REASON
  }
  // Monitor はシェルのコマンドか WebSocket を見張る。版によっては無いツールなので名前を文字列で比べる
  if (String(e.tool) === 'Monitor') {
    const command = 'command' in e ? e.command : undefined
    return typeof command === 'string' && isReadOnlyCommand(command) ? null : BASH_DENY_REASON
  }
  if (e.tool.startsWith('mcp__')) {
    return isReadOnlyMcpTool(e.tool) ? null : MCP_DENY_REASON
  }

  return isReadOnlyTool(e.tool) ? null : TOOL_DENY_REASON
}

export const register: Register = on => {
  // システムプロンプト（prompt.compose）には足さない。Team / Enterprise でログインしている時や
  // managed settings がある環境では、組み込みのガード cc-plugin-sec-default がユーザーの mod の
  // prompt.compose を迂回させるため。prompt.submit に添える文脈はガードの対象外
  on('prompt.submit', async ($, e, next) => {
    // 端末に描かない実行（-p など）では記法が生のまま残り、ボタンも無いので何も添えない
    const surfaces = await $.session.surfaces()
    if (surfaces.length === 0) {
      return next(e)
    }

    const [chatMode, customized, docConcise] = await Promise.all([
      read($, isChatMode),
      read($, isCustomized),
      read($, isDocConcise),
    ])
    const added = [
      customized ? GUIDE_TEXT : PLAIN_TEXT,
      docConcise ? DOC_CONCISE_TEXT : DOC_PLAIN_TEXT,
      ...(chatMode ? [CHAT_MODE_TEXT] : []),
    ]

    return next({ ...e, context: [...(e.context ?? []), ...added] })
  })

  on('tool.call', async ($, e, next) => {
    if (!(await read($, isChatMode))) {
      return next(e)
    }
    const reason = chatModeDenyReason(e)

    return reason === null ? next(e) : { deny: reason }
  }).catch(($, e, next) => {
    // フックが失敗したら止める側に倒す。読み取り用のツールは、チャットモードかどうかに関係なく通してよい
    if (next.called) {
      return next(e)
    }
    const reason = chatModeDenyReason(e)
    if (reason === null) {
      return next(e)
    }

    return { deny: next.error.kind === 're-entry' ? reason : CHECK_FAILED_DENY_REASON }
  })

  on('session.start', async ($, e, next) => {
    await loadSavedToggles($)
    // 端末に描かない実行（-p など）ではボタンを押せないので、サイドバーもコマンドも作らない
    const surfaces = await $.session.surfaces()
    if (surfaces.length > 0) {
      await $.command.register({
        name: PANE_COMMAND,
        description: '出力の設定（チャットモード・応答カスタム・文書を簡潔に）のボタンをサイドバーに開く',
      })
      // 頼まれずに開くサイドバーは、端末の幅が足りるまで描かれない。その間は帯にボタンを出す
      void openPane($)
    }
    return next(e)
  })

  on('command.run', { command: PANE_COMMAND }, async $ => {
    await openPane($)
    return {
      text: '出力の設定のボタンをサイドバーに開いた。全画面表示で端末の幅が 110 文字未満のときは、入力欄の上に出る。',
    }
  })

  // サイドバーが閉じたら、入力欄の上の帯にボタンを戻す
  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE_ID) {
      $.ui.invalidate('ui.render')
    }
    return closed
  })

  // /clear・/resume・/branch は $.state を既定値に戻し、session.start は再び来ないので読み直す
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await loadSavedToggles($)
    return next(e)
  })

  // サイドバーに置けないとき（全画面でない表示・端末の幅が足りない・閉じた）だけ、入力欄の上の帯にボタンを出す
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // アンケートが帯を使っている間は譲る
    if (e.props.hasSurvey || (await isPanePlaced($))) {
      return next(e)
    }

    const states = await readToggleStates($)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" columnGap={3}>
        {states.map(({ toggle, isOn, onPress }) => (
          <Box flexDirection="row">
            <Button key={toggle.key} label={toggle.label} plain onPress={onPress} />
            <Text color={isOn ? toggle.onColor : undefined} dimColor={!isOn}>
              {isOn ? ' ON' : ' OFF'}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })

  // サイドバーには縦に並べる。全画面でない表示や幅の狭い端末では、入力欄の上に枠付きで出るので横に並べる
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const states = await readToggleStates($)
    const { Box, Button, Text } = $.ui.resolve(e)
    const isDocked = e.props.placement === 'dock'

    return (
      <Box flexDirection={isDocked ? 'column' : 'row'} columnGap={3} rowGap={1}>
        {states.map(({ toggle, isOn, onPress }) => (
          <Box flexDirection="row">
            <Button key={toggle.key} label={toggle.label} plain onPress={onPress} />
            <Text color={isOn ? toggle.onColor : undefined} dimColor={!isOn}>
              {isOn ? ' ON' : ' OFF'}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })

  // チャットモード中は、画面下のモード表示にも出し、読み取り専用であることを常に見せる
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (!(await read($, isChatMode))) {
      return next(e)
    }
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, CHAT_MODE_LABEL] } })
  })

  // 次アクションの「Claude：〜して」を、入力欄の薄い候補（Tab で取り込む）に出す
  on('turn.complete', async ($, e, next) => {
    const completed = await next(e)
    // サブエージェントのターンは、利用者が次に送るプロンプトとは関係しない
    if (e.agentId !== undefined) {
      return completed
    }

    const request = !e.isAborted && (await read($, isCustomized)) ? nextClaudeRequest(e.answer) : null
    await update($, nextSuggestion, () => request ?? '')
    if (request !== null) {
      try {
        await $.prompt.suggest({ text: request })
      } catch {
        // 入力欄が無い実行（-p など）では出せない。候補は補助なので、出せなくても続ける
      }
    }
    return completed
  })

  // エンジン自身の候補が後から来ても、次アクションの依頼文があればそちらを出す
  on('prompt.suggest', async ($, e, next) => {
    if (e.origin.kind !== 'suggestion') {
      return next(e)
    }
    const request = await read($, nextSuggestion)
    return next(request === '' ? e : { ...e, text: request })
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const blocks = parse(e.props.text)
    const isTooLong = blocks.some(
      block => block.kind === 'markdown' && block.text.length > MARKDOWN_MAX_LENGTH,
    )
    if (isTooLong || !hasEmphasis(blocks)) {
      return next(e)
    }

    const { Box, Text, Link, Markdown } = $.ui.resolve(e)

    /**
     * 1 行の断片を描く。色は親の Text から受け継ぐ
     * @param span - 描く断片
     * @returns 断片の要素か文字列
     */
    const renderSpan = (span: Span) => {
      switch (span.kind) {
        case 'mark':
          return (
            <Text color={EMPHASIS_COLOR} bold>
              {span.text}
            </Text>
          )
        case 'spec':
          return <Text color={SPEC_COLOR}>{span.text}</Text>
        case 'bold':
          return <Text bold>{span.text}</Text>
        case 'code':
          return <Text color={CODE_COLOR}>{span.text}</Text>
        case 'link':
          return <Link href={span.href}>{span.text}</Link>
        default:
          return span.text
      }
    }

    /**
     * 描画の単位を 1 つ描く
     * @param block - 描く単位
     * @returns その要素
     */
    const renderBlock = (block: Block) => {
      switch (block.kind) {
        case 'markdown':
          return <Markdown text={block.text} />
        case 'gap':
          return <Text> </Text>
        case 'line': {
          const style = block.tone === null ? undefined : TONE_STYLES[block.tone]
          return (
            <Text color={style?.color} bold={style?.bold}>
              {block.indent}
              {block.marker}
              {block.spans.map(renderSpan)}
            </Text>
          )
        }
      }
    }

    return (
      <Box flexDirection="row">
        <Box width={2} flexShrink={0}>
          <Text>{e.props.isFirstOfReply ? '⏺' : ' '}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          {blocks.map(renderBlock)}
        </Box>
      </Box>
    )
  })
}

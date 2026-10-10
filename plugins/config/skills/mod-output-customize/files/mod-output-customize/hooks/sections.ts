/** 節の見出し（# から ### まで）。概要・簡潔版・次アクションの始まりと終わりを決める */
const HEADING = /^(#{1,3})\s+(.*?)\s*$/

/** コードブロックの開始と終了（``` または ~~~ の並び）。中の見出しは数えない */
const FENCE = /^\s*(`{3,}|~{3,})/

/** 行頭の字下げ・リストの記号のあとの ✅ / ❌ の印 */
const TONE_MARK = /^(\s*(?:(?:[-*+]|\d+[.)])\s+)?)(?:✅|❌)️?\s*/

/** 文中の `コード`・==語句==・{{仕様}}。コードの中の == や {{ }} は外さない */
const MARKS = /`[^`]+`|==([^\s=](?:[^=]*?[^\s=])?)==|\{\{([^\s{}](?:[^{}]*?[^\s{}])?)\}\}/g

/** 次アクションの項目のうち、Claude ができる作業の行 */
const CLAUDE_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+Claude\s*[：:]\s*(.+?)\s*$/

/** 概要を畳んだときに、本文の代わりに置く 1 行 */
export const FOLDED_OVERVIEW =
  '（概要を畳んでいます。サイドバーの「概要を畳む」を OFF にすると表示します）'

/** 節の見出しの行と、次の見出しの行（無ければ末尾） */
type SectionRange = { heading: number; end: number }

/**
 * 見出しの題で節を探す
 * @param lines - 応答の行
 * @param title - 探す見出しの題（「概要」など。# の数は問わない）
 * @returns 見つかった節の範囲。無ければ null
 */
function findSection(lines: readonly string[], title: string): SectionRange | null {
  let fence: string | null = null
  let heading = -1

  for (const [index, line] of lines.entries()) {
    if (fence !== null) {
      if (line.trimStart().startsWith(fence)) {
        fence = null
      }
      continue
    }
    const opener = line.match(FENCE)
    if (opener) {
      fence = opener[1] ?? null
      continue
    }
    const match = line.match(HEADING)
    if (!match) {
      continue
    }
    if (heading !== -1) {
      return { heading, end: index }
    }
    if (match[2] === title) {
      heading = index
    }
  }

  return heading === -1 ? null : { heading, end: lines.length }
}

/**
 * 概要の本文を 1 行の案内に置き換える
 * @param text - 応答の 1 ブロック分の markdown
 * @returns 畳んだ markdown。概要の節が無ければ null
 */
export function foldOverview(text: string): string | null {
  const lines = text.split('\n')
  const section = findSection(lines, '概要')
  if (section === null) {
    return null
  }

  return [
    ...lines.slice(0, section.heading + 1),
    '',
    FOLDED_OVERVIEW,
    '',
    ...lines.slice(section.end),
  ].join('\n')
}

/**
 * 節の本文を取り出す
 * @param text - 応答の markdown
 * @param title - 取り出す見出しの題（「簡潔版」「次アクション」など）
 * @returns 前後の空行を除いた本文。節が無いか、本文が空なら null
 */
export function extractSection(text: string, title: string): string | null {
  const lines = text.split('\n')
  const section = findSection(lines, title)
  if (section === null) {
    return null
  }
  const body = lines.slice(section.heading + 1, section.end).join('\n').trim()

  return body === '' ? null : body
}

/**
 * 外に貼る文から、チャット用の記法を外す。【警告】などの分類のラベルは意味があるので残す
 * @param text - 節の本文
 * @returns ✅ / ❌ の印と ==語句== / {{仕様}} の囲みを外した文
 */
export function toPlainText(text: string): string {
  return text
    .split('\n')
    .map(line =>
      line
        .replace(TONE_MARK, '$1')
        .replace(MARKS, (whole, mark: string | undefined, spec: string | undefined) => mark ?? spec ?? whole),
    )
    .join('\n')
}

/**
 * 次アクションのうち、最初の「Claude：〜」の作業を取り出す
 * @param text - 応答の markdown
 * @returns 入力欄の候補に出す依頼文。Claude の項目が無ければ null
 */
export function nextClaudeRequest(text: string): string | null {
  const section = extractSection(text, '次アクション')
  if (section === null) {
    return null
  }
  for (const line of section.split('\n')) {
    const request = line.match(CLAUDE_ITEM)?.[1]
    if (request !== undefined) {
      return toPlainText(request)
    }
  }

  return null
}

/** 会話の 1 件。session.messages の要素のうち、ここで使う部分 */
type Message = { role: 'user' | 'assistant'; text: string }

/**
 * 最新の応答を取り出す。最後に人が書いた発言より後の、assistant の本文をつなげる
 * （ツールを挟むと 1 つの応答が複数の発言に分かれるため）
 * @param messages - 会話の発言の一覧（古い順）
 * @returns 最新の応答の本文。応答が無ければ null
 */
export function latestAnswer(messages: readonly Message[]): string | null {
  const texts: string[] = []
  for (const message of [...messages].reverse()) {
    if (message.role === 'user') {
      // ツールの結果だけの発言（本文が空）は人の発言ではないので、さかのぼり続ける
      if (message.text.trim() !== '') {
        break
      }
      continue
    }
    if (message.text.trim() !== '') {
      texts.unshift(message.text)
    }
  }

  return texts.length === 0 ? null : texts.join('\n\n')
}

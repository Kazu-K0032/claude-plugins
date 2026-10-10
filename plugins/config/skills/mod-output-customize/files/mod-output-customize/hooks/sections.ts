/** 節の見出し（# から ### まで）。次アクションの始まりと終わりを決める */
const HEADING = /^(#{1,3})\s+(.*?)\s*$/

/** コードブロックの開始と終了（``` または ~~~ の並び）。中の見出しは数えない */
const FENCE = /^\s*(`{3,}|~{3,})/

/** 行頭の字下げ・リストの記号のあとの ✅ / ❌ の印 */
const TONE_MARK = /^(\s*(?:(?:[-*+]|\d+[.)])\s+)?)(?:✅|❌)️?\s*/

/** 文中の `コード`・==語句==・{{仕様}}。コードの中の == や {{ }} は外さない */
const MARKS = /`[^`]+`|==([^\s=](?:[^=]*?[^\s=])?)==|\{\{([^\s{}](?:[^{}]*?[^\s{}])?)\}\}/g

/** 次アクションの項目のうち、Claude ができる作業の行 */
const CLAUDE_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+Claude\s*[：:]\s*(.+?)\s*$/

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
 * 入力欄の候補に出す文から、チャット用の記法を外す。【警告】などの分類のラベルは意味があるので残す
 * @param text - 外す前の文
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

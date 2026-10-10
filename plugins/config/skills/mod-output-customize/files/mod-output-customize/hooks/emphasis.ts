/** 行頭の印が表す強調の種類 */
export type Tone = 'conclusion' | 'caution'

/** 1 行の中の一続きの文字列と、その飾り */
export type Span =
  | { kind: 'plain' | 'bold' | 'mark' | 'spec' | 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

/** 描画の単位。markdown は engine と同じ描画に任せ、line は自前で色を付ける */
export type Block =
  | { kind: 'markdown'; text: string }
  | {
      kind: 'line'
      indent: string
      marker: string
      tone: Tone | null
      spans: Span[]
    }
  | { kind: 'gap' }

/** 行頭の印と、それが表す強調の種類 */
const TONE_BY_EMOJI: Record<string, Tone> = { '✅': 'conclusion', '❌': 'caution' }

/** 行頭の字下げ・リストの記号・✅ / ❌ の印 */
const TONED_LINE = /^(\s*)((?:[-*+]|\d+[.)])\s+)?(✅|❌)️?\s*(.*)$/

/** ❌ の行の先頭に置く分類のラベル（【禁止】【警告】など） */
const CATEGORY_LABEL = /^【[^】\s]{1,8}】/

/** 行頭の字下げとリストの記号 */
const LIST_LINE = /^(\s*)((?:[-*+]|\d+[.)])\s+)?(.*)$/

/** コードブロックの開始（``` または ~~~ の並び） */
const FENCE = /^\s*(`{3,}|~{3,})/

/** 色を付けない行（見出し・表・引用）。中の ==語句== は太字に置き換える */
const MARKDOWN_ONLY_LINE = /^\s*(?:#{1,6}\s|\||>)/

/**
 * 1 行の中の飾り: `code`・**太字**・==重要==・{{仕様}}・[リンク](URL)。
 * ==語句== と {{仕様}} は直後と直前が空白でないものだけを拾い、`a == b` のような比較式を誤検出しない
 */
const INLINE =
  /`([^`]+)`|\*\*(.+?)\*\*|==([^\s=](?:[^=]*?[^\s=])?)==|\{\{([^\s{}](?:[^{}]*?[^\s{}])?)\}\}|\[([^\]]+)\]\(([^)\s]+)\)/g

/**
 * 1 行を飾りごとの断片に分ける
 * @param text - 分ける行（リストの記号や ✅ / ❌ を除いた本文）
 * @returns 出現順の断片。飾りのない部分は plain になる
 */
export function toSpans(text: string): Span[] {
  const spans: Span[] = []
  let last = 0

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) {
      spans.push({ kind: 'plain', text: text.slice(last, index) })
    }
    const [whole, code, bold, mark, spec, label, href] = match
    if (code !== undefined) {
      spans.push({ kind: 'code', text: code })
    } else if (bold !== undefined) {
      spans.push({ kind: 'bold', text: bold })
    } else if (mark !== undefined) {
      spans.push({ kind: 'mark', text: mark })
    } else if (spec !== undefined) {
      spans.push({ kind: 'spec', text: spec })
    } else if (label !== undefined && href !== undefined) {
      spans.push({ kind: 'link', text: label, href })
    }
    last = index + whole.length
  }
  if (last < text.length) {
    spans.push({ kind: 'plain', text: text.slice(last) })
  }

  return spans
}

/**
 * markdown のまま描く行の記法を外す。==語句== は **語句** に、{{仕様}} は飾りのない文字にする（記法をそのまま見せない）
 * @param line - 置き換える行
 * @returns 置き換えた行。コードの中の == や {{ }} は触らない
 */
export function unwrapMarks(line: string): string {
  return line.replace(
    INLINE,
    (whole, _code, _bold, mark: string | undefined, spec: string | undefined) =>
      mark !== undefined ? `**${mark}**` : (spec ?? whole),
  )
}

/**
 * 自前で色を付ける行なら line ブロックにする
 * @param line - 判定する行（コードブロックの外のもの）
 * @returns ✅ / ❌ で始まる行か ==語句== / {{仕様}} を含む行なら line ブロック、それ以外は null
 */
function toLineBlock(line: string): Block | null {
  if (line.trim() === '' || MARKDOWN_ONLY_LINE.test(line)) {
    return null
  }

  const toned = line.match(TONED_LINE)
  if (toned) {
    const [, indent = '', marker = '', emoji = '', body = ''] = toned
    const tone = TONE_BY_EMOJI[emoji] ?? null
    const label = body.match(CATEGORY_LABEL)?.[0]
    const spans: Span[] =
      label === undefined
        ? toSpans(body)
        : [{ kind: 'bold', text: label }, ...toSpans(body.slice(label.length))]

    return {
      kind: 'line',
      indent,
      marker: `${normalizeMarker(marker)}${emoji} `,
      tone,
      spans,
    }
  }

  const [, indent = '', marker = '', body = ''] = line.match(LIST_LINE) ?? []
  const spans = toSpans(body)
  if (!spans.some(span => span.kind === 'mark' || span.kind === 'spec')) {
    return null
  }

  return { kind: 'line', indent, marker: normalizeMarker(marker), tone: null, spans }
}

/**
 * リストの記号をそろえる（`*` `+` は `-` として描く）
 * @param marker - 行頭のリストの記号と後ろの空白
 * @returns 描く記号。リストでなければ空文字
 */
function normalizeMarker(marker: string): string {
  const symbol = marker.trim()
  if (symbol === '') {
    return ''
  }

  return /^[*+]$/.test(symbol) ? '- ' : `${symbol} `
}

/**
 * 応答のテキストを描画の単位に分ける
 * @param text - 応答の 1 ブロック分の markdown
 * @returns 描画の単位。色を付ける行が無ければ markdown のブロックだけになる
 */
export function parse(text: string): Block[] {
  const blocks: Block[] = []
  let buffer: string[] = []
  let fence: string | null = null

  const pushGap = () => {
    const previous = blocks[blocks.length - 1]
    if (previous !== undefined && previous.kind !== 'gap') {
      blocks.push({ kind: 'gap' })
    }
  }

  // ためた markdown の行を 1 ブロックにする。前後の空行は gap として残し、行の間隔を保つ
  const flush = () => {
    const lines = buffer
    buffer = []
    const first = lines.findIndex(line => line.trim() !== '')
    if (first === -1) {
      if (lines.length > 0) {
        pushGap()
      }
      return
    }
    const last = lines.length - 1 - [...lines].reverse().findIndex(line => line.trim() !== '')
    if (first > 0) {
      pushGap()
    }
    blocks.push({ kind: 'markdown', text: lines.slice(first, last + 1).join('\n') })
    if (last < lines.length - 1) {
      pushGap()
    }
  }

  for (const line of text.split('\n')) {
    if (fence !== null) {
      buffer.push(line)
      if (line.trimStart().startsWith(fence)) {
        fence = null
      }
      continue
    }

    const opener = line.match(FENCE)
    if (opener) {
      fence = opener[1] ?? null
      buffer.push(line)
      continue
    }

    const block = toLineBlock(line)
    if (block === null) {
      buffer.push(unwrapMarks(line))
      continue
    }
    flush()
    blocks.push(block)
  }
  flush()

  while (blocks[blocks.length - 1]?.kind === 'gap') {
    blocks.pop()
  }

  return blocks
}

/**
 * 自前で描く必要がある応答か
 * @param blocks - parse の結果
 * @returns 色を付ける行が 1 つでもあれば true
 */
export function hasEmphasis(blocks: readonly Block[]): boolean {
  return blocks.some(block => block.kind === 'line')
}

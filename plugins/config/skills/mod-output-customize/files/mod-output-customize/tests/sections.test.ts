import { expect, test } from 'claude-code/testing'

import {
  extractSection,
  FOLDED_OVERVIEW,
  foldOverview,
  latestAnswer,
  nextClaudeRequest,
  toPlainText,
} from '../hooks/sections'

/** 簡潔版・概要・次アクションのそろった応答 */
const ANSWER = [
  '### 簡潔版',
  '',
  '✅ 結論の文。なぜなら、==大事な点== があるからだ。',
  '',
  '### 概要',
  '',
  '詳しい説明。',
  '',
  '```markdown',
  '### コードの中の見出し',
  '```',
  '',
  '## 次アクション',
  '',
  '- あなた：`tmp.md` の内容でコミットする',
  '- Claude：README の説明を直して',
].join('\n')

test('概要の本文を 1 行の案内に置き換え、ほかの節は残す', () => {
  const folded = foldOverview(ANSWER)

  expect(folded).toContain('### 簡潔版')
  expect(folded).toContain('### 概要')
  expect(folded).toContain(FOLDED_OVERVIEW)
  expect(folded).toContain('## 次アクション')
  expect(folded).not.toContain('詳しい説明。')
  // コードブロックの中の見出しで、概要の終わりを決めない
  expect(folded).not.toContain('### コードの中の見出し')
})

test('概要の節が無い応答は畳まない', () => {
  expect(foldOverview('普通の返答だけ')).toBe(null)
})

test('節の本文を取り出し、記法を外して外に貼れる文にする', () => {
  const summary = extractSection(ANSWER, '簡潔版')

  expect(summary).toBe('✅ 結論の文。なぜなら、==大事な点== があるからだ。')
  expect(toPlainText(summary ?? '')).toBe('結論の文。なぜなら、大事な点 があるからだ。')
  expect(extractSection(ANSWER, '無い節')).toBe(null)
})

test('記法を外すとき、分類のラベルとコードの中は残す', () => {
  const text = ['- ❌ 【警告】まだ試していない（例：{{仕様}} の確認）', '- `a == b` はそのまま'].join('\n')

  expect(toPlainText(text)).toBe(['- 【警告】まだ試していない（例：仕様 の確認）', '- `a == b` はそのまま'].join('\n'))
})

test('次アクションの最初の「Claude：」の項目を依頼文として取り出す', () => {
  expect(nextClaudeRequest(ANSWER)).toBe('README の説明を直して')
  expect(nextClaudeRequest(['## 次アクション', '', '- あなた：コミットする'].join('\n'))).toBe(null)
  expect(nextClaudeRequest('次アクションの無い返答')).toBe(null)
})

test('最新の応答は、最後の人の発言より後の assistant の本文をつなげたもの', () => {
  const messages = [
    { role: 'user', text: '前の質問' },
    { role: 'assistant', text: '前の応答' },
    { role: 'user', text: '今の質問' },
    { role: 'assistant', text: '調べます' },
    // ツールの結果だけの発言は、人の発言として扱わない
    { role: 'user', text: '' },
    { role: 'assistant', text: '### 簡潔版\n\n答え' },
  ] as const

  expect(latestAnswer(messages)).toBe('調べます\n\n### 簡潔版\n\n答え')
  expect(latestAnswer([{ role: 'user', text: '質問だけ' }])).toBe(null)
})

import { expect, test } from 'claude-code/testing'

import { extractSection, nextClaudeRequest, toPlainText } from '../hooks/sections'

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

test('節の本文を取り出し、記法を外した文にする', () => {
  const summary = extractSection(ANSWER, '簡潔版')

  expect(summary).toBe('✅ 結論の文。なぜなら、==大事な点== があるからだ。')
  expect(toPlainText(summary ?? '')).toBe('結論の文。なぜなら、大事な点 があるからだ。')
  expect(extractSection(ANSWER, '無い節')).toBe(null)
  // コードブロックの中の見出しで、節の終わりを決めない
  expect(extractSection(ANSWER, '概要')).toContain('### コードの中の見出し')
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

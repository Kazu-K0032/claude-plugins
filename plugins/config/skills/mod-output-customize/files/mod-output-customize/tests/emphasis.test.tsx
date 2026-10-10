import { expect, test } from 'claude-code/testing'

import { parse, unwrapMarks } from '../hooks/emphasis'

/** 並ぶボタンの key */
const BUTTON_KEYS = ['toggle-chat-mode', 'toggle-customized', 'toggle-doc-concise']

const SURFACES = ['terminal', 'desktop'] as const

test('✅ / ❌ の行と ==語句== を含む行だけを色付きの行に分ける', () => {
  const blocks = parse(
    [
      '✅ 結論の文',
      '',
      '普通の段落',
      '- ❌ 禁止の項目',
      '- 普通の項目',
      '文中の ==重要== な語句',
    ].join('\n'),
  )

  expect(blocks.map(block => block.kind)).toEqual([
    'line',
    'gap',
    'markdown',
    'line',
    'markdown',
    'line',
  ])
  expect(blocks[0]).toEqual({
    kind: 'line',
    indent: '',
    marker: '✅ ',
    tone: 'conclusion',
    spans: [{ kind: 'plain', text: '結論の文' }],
  })
  expect(blocks[3]).toMatchObject({ marker: '- ❌ ', tone: 'caution' })
  expect(blocks[5]).toMatchObject({
    tone: null,
    spans: [
      { kind: 'plain', text: '文中の ' },
      { kind: 'mark', text: '重要' },
      { kind: 'plain', text: ' な語句' },
    ],
  })
})

test('❌ の行の先頭の【分類】は太字の断片に分ける', () => {
  const [block] = parse('- ❌ 【禁止】本番の DB を消さない（例：`drop` は戻せない）')

  expect(block).toMatchObject({
    marker: '- ❌ ',
    tone: 'caution',
    spans: [
      { kind: 'bold', text: '【禁止】' },
      { kind: 'plain', text: '本番の DB を消さない（例：' },
      { kind: 'code', text: 'drop' },
      { kind: 'plain', text: ' は戻せない）' },
    ],
  })
})

test('コードの中・比較式・見出しや表は色付きの行にしない', () => {
  const text = [
    '```ts',
    '✅ コードの中',
    'if (a ==b== c) {}',
    '```',
    '`x ==y== z` と a == b',
    '## 見出しの ==語句==',
    '| 表の ==語句== |',
  ].join('\n')
  const blocks = parse(text)

  expect(blocks.map(block => block.kind)).toEqual(['markdown'])
  expect(blocks[0]).toMatchObject({
    text: [
      '```ts',
      '✅ コードの中',
      'if (a ==b== c) {}',
      '```',
      '`x ==y== z` と a == b',
      '## 見出しの **語句**',
      '| 表の **語句** |',
    ].join('\n'),
  })
  expect(unwrapMarks('`==a==` と ==b== と {{c}} と `{{d}}`')).toBe('`==a==` と **b** と c と `{{d}}`')
})

test('{{仕様}} を含む行は色付きの行にし、空白で始まる {{ }} や `コード` の中は拾わない', () => {
  const blocks = parse(['既定値は {{30 秒}} で変えられる', 'テンプレートの {{ name }} と `{{x}}`'].join('\n'))

  expect(blocks.map(block => block.kind)).toEqual(['line', 'markdown'])
  expect(blocks[0]).toMatchObject({
    tone: null,
    spans: [
      { kind: 'plain', text: '既定値は ' },
      { kind: 'spec', text: '30 秒' },
      { kind: 'plain', text: ' で変えられる' },
    ],
  })
})

test('印のある応答は ✅ の行を赤の太字で描く', async $ => {
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: 'mod-output-customize',
      surface,
      component: 'AssistantMessage',
      props: { text: '✅ 結論の文\n\n普通の段落', isFirstOfReply: true },
    })

    const line = await ui.find({ type: 'Text', text: /結論の文/ })
    expect(line?.props).toMatchObject({ color: 'red', bold: true })
    expect(await ui.find({ type: 'Markdown', text: /普通の段落/ })).toBeDefined()
    await ui.unmount()
  }
})

test('==語句== を赤の太字、{{仕様}} を緑で描く', async $ => {
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: 'mod-output-customize',
      surface,
      component: 'AssistantMessage',
      props: { text: '上限は {{100 件}} で、==超えると失敗する==', isFirstOfReply: true },
    })

    expect((await ui.find({ type: 'Text', text: /^100 件$/ }))?.props).toMatchObject({ color: '#22c55e' })
    expect((await ui.find({ type: 'Text', text: /^超えると失敗する$/ }))?.props).toMatchObject({
      color: 'red',
      bold: true,
    })
    await ui.unmount()
  }
})

test('印のない応答は engine の描画に任せる', async ($, on) => {
  let isEngineDrawn = false
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    isEngineDrawn = true
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text: '普通の段落と `a == b`', isFirstOfReply: true },
  })

  expect(isEngineDrawn).toBe(true)
  await ui.unmount()
})

/** 入力欄から送ったプロンプト */
const PROMPT = { text: '質問', wait: false, origin: { kind: 'composer' } } as const

/** 入力欄の上の帯を描くときの props */
const BAND_PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
} as const

test('ボタンには数字キーを割り当てず、クリックでだけ切り替える', async ($, on) => {
  on('session.surfaces', () => ({ value: ['terminal'] }))

  const band = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })
  const buttons = await band.findAll({ type: 'Button' })

  expect(buttons.map(button => button.key)).toEqual(BUTTON_KEYS)
  expect(buttons.map(button => button.props.hotkey)).toEqual(BUTTON_KEYS.map(() => undefined))

  await band.unmount()
})

test('端末に描く実行ではプロンプトに記法の説明を文脈として添える', async ($, on) => {
  let surfaces: readonly ('terminal' | 'desktop')[] = ['terminal']
  on('session.surfaces', () => ({ value: surfaces }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))

  const drawn = await $.prompt.submit(PROMPT)
  expect(drawn.text).toBe('質問')
  expect(drawn.context?.some(block => block.includes('# 応答の色分け'))).toBe(true)
  expect(drawn.context?.some(block => block.includes('### 簡潔版') && block.includes('## 次アクション'))).toBe(true)
  expect(drawn.context?.some(block => block.includes('なぜなら') && block.includes('つまり'))).toBe(true)
  expect(drawn.context?.some(block => block.includes('# 文書の書き方') && block.includes('文字数を少なく'))).toBe(true)
  expect(drawn.context?.some(block => block.includes('チャットモード'))).toBe(false)

  surfaces = []
  const printed = await $.prompt.submit(PROMPT)
  expect(printed.context ?? []).toEqual([])
})

test('応答カスタムのボタンで OFF にすると、記法を使わせない文を添えて保存する', async ($, on) => {
  const saved: [string, unknown][] = []
  on('store.set', (_$, e) => {
    saved.push([e.key, e.value])
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))

  const band = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })
  await band.press({ key: 'toggle-customized' })

  const submitted = await $.prompt.submit(PROMPT)
  expect(submitted.context?.some(block => block.includes('# 応答の色分け'))).toBe(false)
  expect(submitted.context?.some(block => block.includes('# 応答の形式') && block.includes('今回は通常の形式'))).toBe(true)
  expect(saved).toEqual([['isCustomized', false]])

  await band.unmount()
})

test('文書を簡潔にのボタンで OFF にすると、解除の文を添えて保存する', async ($, on) => {
  const saved: [string, unknown][] = []
  on('store.set', (_$, e) => {
    saved.push([e.key, e.value])
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))

  const band = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })
  await band.press({ key: 'toggle-doc-concise' })

  const submitted = await $.prompt.submit(PROMPT)
  expect(submitted.context?.some(block => block.includes('文字数を少なく'))).toBe(false)
  expect(submitted.context?.some(block => block.includes('# 文書の書き方') && block.includes('解除'))).toBe(true)
  expect(submitted.context?.some(block => block.includes('# 応答の色分け'))).toBe(true)
  expect(saved).toEqual([['isDocConcise', false]])

  await band.unmount()
})

test('チャットモードのボタンで ON にすると、読み取り用のツールとコマンドだけを通す', async ($, on) => {
  const saved: unknown[] = []
  on('store.set', (_$, e) => {
    saved.push(e.value)
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  const ran: string[] = []
  on('tool.call', (_$, e) => {
    ran.push(e.tool === 'Bash' ? e.command : e.tool)
    return { result: 'ok' }
  })

  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(ran).toEqual(['rm -rf build'])

  const band = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })
  expect(await band.find({ type: 'Text', text: /OFF/ })).toBeDefined()
  await band.press({ key: 'toggle-chat-mode' })

  ran.length = 0
  await $.tool.call({ tool: 'Bash', command: 'grep -rn foo src | head -5 2>/dev/null' })
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  await $.tool.call({ tool: 'Bash', command: 'cat a.txt > b.txt' })
  await $.tool.call({ tool: 'Edit', file_path: '/tmp/a.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Write', file_path: '/tmp/a.ts', content: 'a' })
  await $.tool.call({ tool: 'Read', file_path: '/tmp/a.ts' })
  await $.tool.call({ tool: 'PowerShell', command: 'Remove-Item a.txt' })
  await $.tool.call({ tool: 'Monitor', description: 'm', timeout_ms: 1000, command: 'rm -rf build' })
  await $.tool.call({ tool: 'Monitor', description: 'm', timeout_ms: 1000, command: 'tail -n 5 log.txt' })
  await $.tool.call({ tool: 'CronCreate', cron: '*/5 * * * *', prompt: 'x' })
  await $.tool.call({ tool: 'Glob', pattern: '*.ts' })
  await $.tool.call({ tool: 'mcp__claude_ai_Gmail__send_message', to: 'a@example.com' })
  await $.tool.call({ tool: 'mcp__claude_ai_Gmail__get_thread', thread_id: 't' })
  expect(ran).toEqual([
    'grep -rn foo src | head -5 2>/dev/null',
    'Read',
    'Monitor',
    'Glob',
    'mcp__claude_ai_Gmail__get_thread',
  ])

  const submitted = await $.prompt.submit(PROMPT)
  expect(submitted.context?.some(block => block.includes('# チャットモード'))).toBe(true)
  expect(saved).toEqual([])

  await band.press({ key: 'toggle-chat-mode' })
  ran.length = 0
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(ran).toEqual(['rm -rf build'])

  await band.unmount()
})

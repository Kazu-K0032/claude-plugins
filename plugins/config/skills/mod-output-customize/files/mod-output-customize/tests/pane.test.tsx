import { expect, test } from 'claude-code/testing'

/** 並ぶボタンの key。on/off の 4 つと、コピーの 2 つ */
const BUTTON_KEYS = [
  'toggle-chat-mode',
  'toggle-customized',
  'toggle-doc-concise',
  'toggle-summary-only',
  'copy-summary',
  'copy-next-actions',
]

const SURFACES = ['terminal', 'desktop'] as const

/** ボタンを並べるサイドバーの id */
const PANE_ID = 'output-customize'

/** サイドバーに置かれたときの props */
const DOCKED_PANE_PROPS = {
  title: '出力の設定',
  isFocused: false,
  bodyColumns: 22,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as const

/** 入力欄の上の帯を描くときの props */
const BAND_PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
} as const

/** サイドバーが描かれているときの、この mod の Pane */
const PLACED_PANE = { id: PANE_ID, title: '出力の設定', isShown: true, isFocused: false, isPlaced: true }

test('サイドバーにボタンを縦に並べ、クリックで on/off を切り替える', async ($, on) => {
  on('store.set', () => ({ value: undefined }))

  for (const surface of SURFACES) {
    const pane = await $.ui.mount({
      plugin: 'mod-output-customize',
      surface,
      component: 'Pane',
      requestId: PANE_ID,
      props: DOCKED_PANE_PROPS,
    })
    const buttons = await pane.findAll({ type: 'Button' })
    expect(buttons.map(button => button.key)).toEqual(BUTTON_KEYS)
    expect(buttons.map(button => button.props.hotkey)).toEqual(BUTTON_KEYS.map(() => undefined))
    expect(await pane.drawn()).toMatchObject({ type: 'Box', props: { flexDirection: 'column' } })

    const before = await pane.find({ type: 'Text', text: / O(N|FF)$/ })
    await pane.press({ key: 'toggle-chat-mode' })
    const after = await pane.find({ type: 'Text', text: / O(N|FF)$/ })
    expect(after?.text).not.toBe(before?.text)

    // 次の描く場所でも同じ状態から試せるように戻す
    await pane.press({ key: 'toggle-chat-mode' })
    await pane.unmount()
  }
})

test('サイドバーが描かれている間は、入力欄の上の帯にボタンを出さない', async ($, on) => {
  on('ui.panes', () => ({ value: [PLACED_PANE] }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const band = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })
  expect(await band.findAll({ type: 'Button' })).toHaveLength(0)

  await band.unmount()
})

test('サイドバーが描かれていないときは、入力欄の上の帯にボタンを出す', async ($, on) => {
  on('ui.panes', () => ({ value: [{ ...PLACED_PANE, isPlaced: false }] }))

  const band = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })
  expect(await band.findAll({ type: 'Button' })).toHaveLength(BUTTON_KEYS.length)

  await band.unmount()
})

test('コマンドで、閉じたサイドバーを開き直す', async ($, on) => {
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })

  const ran = await $.command.run({
    command: 'output-customize',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })
  expect(opened).toEqual([PANE_ID])
  expect(ran).toMatchObject({ text: expect.stringContaining('サイドバー') })
})

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
  '## 次アクション',
  '',
  '- Claude：README の説明を直して',
].join('\n')

test('「簡潔版をコピー」で、最新の応答の簡潔版を記法を外してクリップボードに入れる', async ($, on) => {
  const copied: string[] = []
  on('session.messages', () => ({
    value: [
      { role: 'user', text: '質問', toolUses: [] },
      { role: 'assistant', text: ANSWER, toolUses: [] },
    ],
  }))
  on('ui.copy', (_$, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.toast', () => ({ value: undefined }))

  const pane = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'Pane',
    requestId: PANE_ID,
    props: DOCKED_PANE_PROPS,
  })
  await pane.press({ key: 'copy-summary' })
  await pane.press({ key: 'copy-next-actions' })

  expect(copied).toEqual(['結論の文。なぜなら、大事な点 があるからだ。', '- Claude：README の説明を直して'])
  await pane.unmount()
})

test('「概要を畳む」を ON にすると、応答の概要の本文を描かない', async ($, on) => {
  on('store.set', () => ({ value: undefined }))

  const pane = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'Pane',
    requestId: PANE_ID,
    props: DOCKED_PANE_PROPS,
  })
  await pane.press({ key: 'toggle-summary-only' })

  const message = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text: ANSWER, isFirstOfReply: true },
  })
  const drawn = JSON.stringify(await message.drawn())
  expect(drawn).toContain('概要を畳んでいます')
  expect(drawn).not.toContain('詳しい説明。')
  expect(drawn).toContain('README の説明を直して')

  await message.unmount()
  await pane.unmount()
})

test('チャットモード中は、画面下のモード表示に「チャット」を足す', async ($, on) => {
  let modes: readonly string[] = []
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    modes = e.props.modes
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.modes.join(' ')}</Text>
  })

  const footer = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes: ['plan'] },
  })
  expect(modes).toEqual(['plan'])
  await footer.unmount()

  const pane = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'Pane',
    requestId: PANE_ID,
    props: DOCKED_PANE_PROPS,
  })
  await pane.press({ key: 'toggle-chat-mode' })
  await pane.unmount()

  const chatFooter = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes: ['plan'] },
  })
  expect(modes).toEqual(['plan', 'チャット'])
  await chatFooter.unmount()
})

test('次アクションに「Claude：」の項目があれば、入力欄の候補に出す', async ($, on) => {
  const suggested: string[] = []
  on('prompt.suggest', (_$, e) => {
    suggested.push(e.text)
    return { isShown: true }
  })
  on('turn.complete', (_$, e) => ({ text: e.answer }))

  const turn = { durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' } as const
  await $.turn.complete({ ...turn, answer: ANSWER })
  expect(suggested).toEqual(['README の説明を直して'])

  await $.turn.complete({ ...turn, turnId: 't2', answer: '次アクションの無い返答' })
  expect(suggested).toHaveLength(1)
})

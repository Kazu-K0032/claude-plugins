import { expect, test } from 'claude-code/testing'

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
    expect(buttons.map(button => button.key)).toEqual(['toggle-chat-mode', 'toggle-customized', 'toggle-doc-concise'])
    expect(buttons.map(button => button.props.hotkey)).toEqual([undefined, undefined, undefined])
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
  expect(await band.findAll({ type: 'Button' })).toHaveLength(3)

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

import { expect, test } from 'claude-code/testing'

import { calledSkillName, parseInstalls, skillLink, typedSkillName } from '../hooks/skill-link'

const SURFACES = ['terminal', 'desktop'] as const

const RESEARCH = 'https://github.com/Kazu-K0032/claude-plugins/blob/v1.1.0/plugins/aidd/skills/research/SKILL.md'
const COMMIT = 'https://github.com/Kazu-K0032/claude-plugins/blob/v1.1.0/plugins/aidd/skills/commit/SKILL.md'

/** aidd を入れた場所 */
const AIDD_PATH = 'C:\\Users\\tester\\.claude\\plugins\\cache\\kazu\\aidd\\1.1.0'

/** 入れたプラグインの記録（~/.claude/plugins/installed_plugins.json） */
const INSTALLED = JSON.stringify({
  version: 2,
  plugins: {
    'aidd@kazu': [{ scope: 'user', installPath: AIDD_PATH, version: '1.1.0' }],
    'config@kazu': [{ scope: 'user', installPath: 'C:\\config', version: '1.1.0' }],
    'project@kazu': [{ scope: 'user', version: '1.1.0' }],
    'other@elsewhere': [{ scope: 'user', installPath: 'C:\\other', version: '9.9.9' }],
  },
})

/** 印の無い、Claude の返事の行 */
const REPLY = { text: '何を調べますか？', isFirstOfReply: true } as const

type Engine = Parameters<Parameters<typeof test>[1]>[0]
type Hooks = Parameters<Parameters<typeof test>[1]>[1]

/**
 * エンジンの描く行・版の記録の読み取り・端末への描画を、テストの側で用意する。手元の SKILL.md は、workflow の pr-review にだけ無い
 * @param on - テストのフックを登録する関数
 * @param installed - 版の記録の中身。null なら読めない
 */
function stand(on: Hooks, installed: string | null = INSTALLED) {
  on('ui.render', { component: ['AssistantMessage', 'ToolUse', 'ToolGroup'] }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('env.get', () => ({ value: 'C:\\Users\\tester' }))
  on('fs.read', () => (installed === null ? { deny: 'no file' } : { value: installed }))
  on('fs.exists', (_$, e) => ({ value: /[\\/]SKILL\.md$/.test(e.path) && !/[\\/]pr-review[\\/]/.test(e.path) }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
}

/**
 * 行を 1 つ描き、付いたリンクの行き先を返す
 * @returns リンクの href の一覧
 */
async function linksOf($: Engine, component: 'AssistantMessage' | 'ToolUse' | 'ToolGroup', requestId: string, props: object) {
  const row = await $.ui.mount({ plugin: 'mod-output-customize', surface: 'terminal', component, requestId, props } as never)
  const hrefs = (await row.findAll({ type: 'Link' })).map(link => link.props.href)
  await row.unmount()
  return hrefs
}

/**
 * 送った入力
 * @param text - 打った行
 */
function typed(text: string) {
  return { text, wait: false, origin: { kind: 'composer' } } as const
}

test('版の記録から、このマーケットプレイスのプラグインの版と置き場所だけを読む', () => {
  expect(parseInstalls(INSTALLED)).toEqual({
    aidd: { version: '1.1.0', path: AIDD_PATH },
    config: { version: '1.1.0', path: 'C:\\config' },
  })
  expect(parseInstalls('{}')).toEqual({})
})

test('このマーケットプレイスのスキルで、版が分かるときだけリンクを作る', () => {
  const installs = parseInstalls(INSTALLED)

  expect(skillLink('aidd:commit', installs)).toEqual({
    name: 'aidd:commit',
    url: COMMIT,
    file: `${AIDD_PATH}/skills/commit/SKILL.md`,
  })
  for (const name of ['project:init-repo', 'other:thing', 'commit', 'aidd:../x', 'aidd:Commit', undefined]) {
    expect(skillLink(name, installs)).toBe(null)
  }
})

test('打った行と Skill ツールの入力から、スキルの名前を取る', () => {
  expect(typedSkillName('/aidd:research 何か')).toBe('aidd:research')
  expect(typedSkillName('  /aidd:commit')).toBe('aidd:commit')
  expect(typedSkillName('/compact')).toBe(undefined)
  expect(typedSkillName('aidd:commit を実行して')).toBe(undefined)
  expect(calledSkillName('Skill', { skill: 'aidd:adr', args: '' })).toBe('aidd:adr')
  expect(calledSkillName('Bash', { skill: 'aidd:adr' })).toBe(undefined)
})

test('打ったスキルのリンクを、その後の最初の返事の上に 1 回だけ、青い文字で付ける', async ($, on) => {
  stand(on)
  await $.prompt.submit(typed('/aidd:research'))

  for (const surface of SURFACES) {
    const row = await $.ui.mount({ plugin: 'mod-output-customize', surface, component: 'AssistantMessage', requestId: 'a1', props: REPLY })
    expect((await row.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([RESEARCH])
    expect((await row.find({ type: 'Text', text: /^SKILL\.md$/ }))?.props).toMatchObject({ color: '#3b82f6' })
    // リンクの行が、返事の行より上にある
    const texts = await row.findAll({ type: 'Text' })
    expect(texts[0]?.text).toContain('aidd:research の手順')
    expect(texts[texts.length - 1]?.text).toBe('engine row')
    await row.unmount()
  }
  // 次の行には付けない。同じ行は描き直しても付いたまま
  expect(await linksOf($, 'AssistantMessage', 'a2', { ...REPLY, isFirstOfReply: false })).toEqual([])
  expect(await linksOf($, 'AssistantMessage', 'a1', REPLY)).toEqual([RESEARCH])
})

test('前から描かれていた返事には付けず、送った後に初めて描かれる行に付ける', async ($, on) => {
  stand(on)
  expect(await linksOf($, 'AssistantMessage', 'old', REPLY)).toEqual([])
  await $.prompt.submit(typed('/aidd:research 何か'))

  expect(await linksOf($, 'AssistantMessage', 'old', REPLY)).toEqual([])
  expect(await linksOf($, 'AssistantMessage', 'new', REPLY)).toEqual([RESEARCH])
})

test('返事より先にツールの行が描かれたら、そのツールの行の上に付ける', async ($, on) => {
  stand(on)
  await $.prompt.submit(typed('/aidd:commit'))
  const bash = { tool_use_id: 't0', tool: 'Bash', input: { command: 'git status' }, isRunning: true, isErrored: false, isInterrupted: false }

  expect(await linksOf($, 'ToolUse', 't0', bash)).toEqual([COMMIT])
  expect(await linksOf($, 'AssistantMessage', 'a1', REPLY)).toEqual([])
})

test('読み取りや検索をまとめた行が先に描かれたら、その行の上に付け、呼び出しが増えても付いたままにする', async ($, on) => {
  stand(on)
  await $.prompt.submit(typed('/aidd:commit'))
  const call = { isRunning: false, isErrored: false, isInterrupted: false }
  const status = { ...call, tool_use_id: 't0', tool: 'Bash', input: { command: 'git status' } }
  const rule = { ...call, tool_use_id: 't1', tool: 'Read', input: { file_path: 'commit-rule.md' } }

  expect(await linksOf($, 'ToolGroup', 'g1', { calls: [status], isActive: true, isExpanded: false })).toEqual([COMMIT])
  expect(await linksOf($, 'ToolGroup', 'g2', { calls: [status, rule], isActive: true, isExpanded: false })).toEqual([COMMIT])
  expect(await linksOf($, 'AssistantMessage', 'a1', REPLY)).toEqual([])
})

test('Claude が呼んだスキルは、Skill の行の下に付ける', async ($, on) => {
  stand(on)
  await $.prompt.submit(typed('Skill ツールで aidd:research を実行して'))
  const skill = { tool_use_id: 't1', tool: 'Skill', input: { skill: 'aidd:research', args: '' }, isRunning: false, isErrored: false, isInterrupted: false }

  for (const surface of SURFACES) {
    const row = await $.ui.mount({ plugin: 'mod-output-customize', surface, component: 'ToolUse', requestId: 't1', props: skill })
    expect((await row.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([RESEARCH])
    const texts = await row.findAll({ type: 'Text' })
    expect(texts[0]?.text).toBe('engine row')
    await row.unmount()
  }
})

test('手元に SKILL.md が無いもの（workflow）を打っても、何も付けない', async ($, on) => {
  stand(on)
  await $.prompt.submit(typed('/aidd:pr-review 93'))

  expect(await linksOf($, 'AssistantMessage', 'a1', REPLY)).toEqual([])
})

test('付ける前に、スキルでない入力を送ったら、前のスキルのリンクは付けない', async ($, on) => {
  stand(on)
  await $.prompt.submit(typed('/aidd:research'))
  await $.prompt.submit(typed('こんにちは'))

  expect(await linksOf($, 'AssistantMessage', 'a1', REPLY)).toEqual([])
})

test('印のある返事でも、色分けした行の上にリンクを付ける', async ($, on) => {
  stand(on)
  await $.prompt.submit(typed('/aidd:research'))

  const row = await $.ui.mount({
    plugin: 'mod-output-customize',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'a1',
    props: { text: '✅ 結論の文', isFirstOfReply: true },
  })
  expect((await row.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([RESEARCH])
  expect((await row.find({ type: 'Text', text: /結論の文/ }))?.props).toMatchObject({ color: 'red', bold: true })
  await row.unmount()
})

test('版の記録を読めないときは、何も付けず、行はそのまま描く', async ($, on) => {
  stand(on, null)
  await $.prompt.submit(typed('/aidd:research'))

  const row = await $.ui.mount({ plugin: 'mod-output-customize', surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: REPLY })
  expect(await row.findAll({ type: 'Link' })).toHaveLength(0)
  expect(await row.find({ type: 'Text', text: 'engine row' })).not.toBeNull()
  await row.unmount()
})

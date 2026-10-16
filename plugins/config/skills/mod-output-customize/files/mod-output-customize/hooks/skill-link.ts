/** スキルの SKILL.md があるリポジトリ */
const REPO_URL = 'https://github.com/Kazu-K0032/claude-plugins'

/** 入れたプラグインの記録（installed_plugins.json）で、プラグイン名の後ろに付くマーケットプレイスの名前 */
const MARKETPLACE = 'kazu'

/** リンクを出すプラグイン */
const PLUGINS: readonly string[] = ['aidd', 'config', 'project']

/** スキルの名前（aidd:commit）。URL とパスの一部にするので、英小文字・数字・- だけを通す */
const SKILL_NAME = /^([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-]*)$/

/** 打った行の先頭のスキル（/aidd:commit …） */
const TYPED_SKILL = /^\s*\/([a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*)(?=\s|$)/

/** 入れたプラグインの版と、置き場所 */
export type Install = { version: string; path: string }

/** スキルの名前と、その SKILL.md への GitHub のリンクと、手元の SKILL.md のパス */
export type SkillLink = { name: string; url: string; file: string }

/**
 * 入れたプラグインの記録から、aidd・config・project の版と置き場所を読む
 * @param json - ~/.claude/plugins/installed_plugins.json の中身
 * @returns プラグイン名から版と置き場所への対応。入っていないプラグインは含めない
 */
export function parseInstalls(json: string): Record<string, Install> {
  const records = (JSON.parse(json) as { plugins?: Record<string, { version?: unknown; installPath?: unknown }[]> }).plugins ?? {}
  const installs: Record<string, Install> = {}
  for (const plugin of PLUGINS) {
    const record = records[`${plugin}@${MARKETPLACE}`]?.[0]
    if (typeof record?.version === 'string' && typeof record.installPath === 'string') {
      installs[plugin] = { version: record.version, path: record.installPath }
    }
  }

  return installs
}

/**
 * スキルの SKILL.md へのリンクを作る。リンク先は、入れている版のタグ（v1.1.0 など）
 * @param name - スキルの名前（aidd:commit）
 * @param installs - parseInstalls で読んだ版と置き場所
 * @returns このマーケットプレイスのスキルで、版が分かるときだけリンク。それ以外は null
 */
export function skillLink(name: string | undefined, installs: Record<string, Install>): SkillLink | null {
  const match = name === undefined ? null : SKILL_NAME.exec(name)
  const [, plugin = '', skill = ''] = match ?? []
  const install = PLUGINS.includes(plugin) ? installs[plugin] : undefined
  if (install === undefined) {
    return null
  }

  return {
    name: `${plugin}:${skill}`,
    url: `${REPO_URL}/blob/v${install.version}/plugins/${plugin}/skills/${skill}/SKILL.md`,
    file: `${install.path}/skills/${skill}/SKILL.md`,
  }
}

/**
 * 利用者が打った行から、スキルの名前を取る
 * @param text - 送った行（/aidd:commit 引数）
 * @returns スキルの名前。スラッシュコマンドで始まらなければ undefined
 */
export function typedSkillName(text: string): string | undefined {
  return TYPED_SKILL.exec(text)?.[1]
}

/**
 * Claude が呼んだツールから、スキルの名前を取る
 * @param tool - ツールの名前
 * @param input - ツールの入力（Skill なら { skill: 'aidd:research' }）
 * @returns Skill ツールならスキルの名前。それ以外は undefined
 */
export function calledSkillName(tool: unknown, input: unknown): string | undefined {
  const skill = (input as { skill?: unknown } | null)?.skill

  return tool === 'Skill' && typeof skill === 'string' ? skill.replace(/^\//, '') : undefined
}

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

/** installed_plugins.json の、1 つの入れ方の記録。projectPath は公式の文書に無いため、あれば使う */
type InstallRecord = { scope?: unknown; installPath?: unknown; version?: unknown; projectPath?: unknown }

/**
 * パスを比べられる形にする。区切りを / にそろえ、末尾の / を外し、Windows のドライブ付きの名前は小文字にする
 * @param path - 元のパス
 * @returns そろえたパス
 */
function normalizePath(path: string): string {
  const slashed = path.replace(/\\/g, '/').replace(/\/+$/, '')

  return /^[A-Za-z]:/.test(slashed) ? slashed.toLowerCase() : slashed
}

/**
 * 記録が、今の作業ディレクトリで効くものか。user は全体向けで、project・local は projectPath が作業ディレクトリを含むものだけ
 * @param record - 入れ方の記録
 * @param cwd - セッションの作業ディレクトリ
 * @returns 効くなら true。project・local で projectPath が無ければ、どこのものか分からないので false
 */
function appliesTo(record: InstallRecord, cwd: string): boolean {
  if (record.scope === 'user') {
    return true
  }
  if (typeof record.projectPath !== 'string') {
    return false
  }
  const root = normalizePath(record.projectPath)
  const here = normalizePath(cwd)

  return here === root || here.startsWith(`${root}/`)
}

/**
 * 記録を、版と置き場所が同じものを 1 つにまとめた一覧にする
 * @param records - 入れ方の記録
 * @returns 版と置き場所が読める記録を、重ねずに並べた一覧
 */
function distinctInstalls(records: readonly InstallRecord[]): Install[] {
  const found = new Map<string, Install>()
  for (const { version, installPath } of records) {
    if (typeof version === 'string' && typeof installPath === 'string') {
      found.set(`${version}\n${installPath}`, { version, path: installPath })
    }
  }

  return [...found.values()]
}

/**
 * 同じプラグインの入れ方の記録から、動いているものを 1 つ選ぶ
 * @param records - 入れ方の記録（user・project・local の範囲ごとに複数ありうる）
 * @param cwd - セッションの作業ディレクトリ
 * @returns 読める記録が 1 通りならそれ。複数あれば、今の作業ディレクトリで効くものが 1 通りのときだけそれ。選べなければ null
 */
function pickInstall(records: readonly InstallRecord[], cwd: string): Install | null {
  const all = distinctInstalls(records)
  if (all.length === 1) {
    return all[0] ?? null
  }
  const applicable = distinctInstalls(records.filter(record => appliesTo(record, cwd)))

  return applicable.length === 1 ? (applicable[0] ?? null) : null
}

/**
 * 入れたプラグインの記録から、aidd・config・project の版と置き場所を読む
 * @param json - ~/.claude/plugins/installed_plugins.json の中身
 * @param cwd - セッションの作業ディレクトリ。同じプラグインの記録が複数あるときに、どれが効くかを選ぶのに使う
 * @returns プラグイン名から版と置き場所への対応。入っていないプラグインと、動いている版を選べないプラグインは含めない
 */
export function parseInstalls(json: string, cwd: string): Record<string, Install> {
  const records = (JSON.parse(json) as { plugins?: Record<string, InstallRecord[]> }).plugins ?? {}
  const installs: Record<string, Install> = {}
  for (const plugin of PLUGINS) {
    const install = pickInstall(records[`${plugin}@${MARKETPLACE}`] ?? [], cwd)
    if (install !== null) {
      installs[plugin] = install
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

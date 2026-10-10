/** chat モードで通すコマンド。ほかのコマンドを起動できるもの・ファイルを書けるものは入れない */
const READ_ONLY_COMMANDS = new Set([
  'basename',
  'cat',
  'cd',
  'cut',
  'df',
  'diff',
  'dirname',
  'du',
  'echo',
  'find',
  'gh',
  'git',
  'grep',
  'head',
  'jq',
  'ls',
  'printf',
  'pwd',
  'realpath',
  'rg',
  'sort',
  'stat',
  'tail',
  'tr',
  'tree',
  'uniq',
  'wc',
  'which',
])

/** git で通すサブコマンド。どれも作業ツリーと履歴を書き換えない */
const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  'blame',
  'describe',
  'diff',
  'grep',
  'log',
  'ls-files',
  'rev-parse',
  'shortlog',
  'show',
  'status',
])

/** gh で通すサブコマンド（グループごとの操作）。どれも GitHub 上の状態とローカルのファイルを変えない */
const READ_ONLY_GH_SUBCOMMANDS: Record<string, readonly string[]> = {
  auth: ['status'],
  issue: ['list', 'status', 'view'],
  label: ['list'],
  pr: ['checks', 'diff', 'list', 'status', 'view'],
  release: ['list', 'view'],
  repo: ['list', 'view'],
  run: ['list', 'view'],
  search: ['code', 'commits', 'issues', 'prs', 'repos'],
  workflow: ['list', 'view'],
}

/** gh api で常に禁じる引数。メソッドの指定と、ファイルから本文を送るもの */
const GH_API_FORBIDDEN_ARGS = ['-X', '--method', '--input']

/** gh api の本文に値を足す引数。付けると POST になるので、graphql の query のときだけ通す */
const GH_API_FIELD_ARGS = ['-f', '-F', '--field', '--raw-field']

/** MCP ツールの名前のうち、読み取りを表す語 */
const MCP_READ_WORDS = new Set([
  'describe',
  'fetch',
  'find',
  'get',
  'inspect',
  'list',
  'lookup',
  'query',
  'read',
  'search',
  'show',
  'status',
  'view',
  'whoami',
])

/** MCP ツールの名前のうち、書き込みや実行を表す語。読み取りの語と並んでいても止める */
const MCP_WRITE_WORDS = new Set([
  'add',
  'apply',
  'archive',
  'authenticate',
  'close',
  'comment',
  'connect',
  'convert',
  'copy',
  'create',
  'delete',
  'download',
  'duplicate',
  'edit',
  'execute',
  'export',
  'forward',
  'generate',
  'import',
  'insert',
  'label',
  'mark',
  'merge',
  'move',
  'patch',
  'post',
  'publish',
  'push',
  'put',
  'register',
  'remove',
  'reply',
  'respond',
  'run',
  'send',
  'set',
  'share',
  'spawn',
  'stop',
  'sync',
  'trash',
  'unlabel',
  'unmark',
  'untrash',
  'update',
  'upload',
  'write',
])

/** コマンドごとに禁じる引数。ファイルへ書き出すもの・ほかのコマンドを起動するもの */
const FORBIDDEN_ARGS: Record<string, readonly string[]> = {
  find: ['-exec', '-execdir', '-ok', '-okdir', '-delete', '-fprint', '-fprint0', '-fprintf', '-fls'],
  git: ['--output', '-O', '--open-files-in-pager', '--ext-diff'],
  rg: ['--pre'],
  sort: ['-o', '--output'],
  tree: ['-o'],
}

/** シェルの字句。単語、区切り（; && || | & 改行）、リダイレクト（> >> < とその向き先） */
type Token =
  | { kind: 'word'; text: string }
  | { kind: 'separator' }
  | { kind: 'redirect'; operator: string; target: string }

/** 字句に分けられない、または中身を確かめられない書き方 */
const UNCHECKABLE = Symbol('uncheckable')

/**
 * コマンド文字列を字句に分ける。コマンド置換・プロセス置換・ヒアドキュメント・サブシェルは確かめられないので UNCHECKABLE を返す
 * @param command - Bash ツールに渡されたコマンド
 * @returns 字句の列か UNCHECKABLE
 */
function tokenize(command: string): Token[] | typeof UNCHECKABLE {
  const tokens: Token[] = []
  let word = ''
  let hasWord = false
  let quote: "'" | '"' | null = null

  const endWord = () => {
    if (hasWord) {
      tokens.push({ kind: 'word', text: word })
    }
    word = ''
    hasWord = false
  }

  for (let index = 0; index < command.length; index++) {
    const char = command[index] ?? ''
    const following = command[index + 1] ?? ''

    if (quote === "'") {
      if (char === "'") {
        quote = null
      } else {
        word += char
      }
      continue
    }

    if (char === '`' || (char === '$' && following === '(')) {
      return UNCHECKABLE
    }

    if (quote === '"') {
      if (char === '"') {
        quote = null
      } else if (char === '\\' && following !== '') {
        word += following
        index++
      } else {
        word += char
      }
      continue
    }

    if (char === "'" || char === '"') {
      quote = char
      hasWord = true
      continue
    }
    if (char === '\\') {
      word += following
      hasWord = true
      index++
      continue
    }
    if (char === ' ' || char === '\t') {
      endWord()
      continue
    }
    if (char === '(' || char === ')' || (char === '{' && !hasWord)) {
      return UNCHECKABLE
    }

    const isRedirect = char === '>' || char === '<' || (char === '&' && following === '>')
    if (isRedirect) {
      const fd = /^\d+$/.test(word) ? word : ''
      if (fd === '') {
        endWord()
      } else {
        word = ''
        hasWord = false
      }
      const operator = command.slice(index).match(/^(&>>?|>>?&?|<<?|<&|<>)/)?.[0] ?? char
      if (operator.startsWith('<<') || command[index + operator.length] === '(') {
        return UNCHECKABLE
      }
      index += operator.length
      while (command[index] === ' ' || command[index] === '\t') {
        index++
      }
      const target = command.slice(index).match(/^[^\s;&|<>()]+/)?.[0] ?? ''
      tokens.push({ kind: 'redirect', operator: `${fd}${operator}`, target })
      index += target.length - 1
      continue
    }

    if (char === ';' || char === '|' || char === '&' || char === '\n') {
      endWord()
      tokens.push({ kind: 'separator' })
      continue
    }

    word += char
    hasWord = true
  }

  if (quote !== null) {
    return UNCHECKABLE
  }
  endWord()

  return tokens
}

/**
 * ファイルを書かないリダイレクトか。入力の < と、/dev/null・別の fd への出力だけを通す
 * @param operator - リダイレクトの記号（fd を含む）
 * @param target - 向き先
 * @returns 書き込みを伴わなければ true
 */
function isHarmlessRedirect(operator: string, target: string): boolean {
  if (/^\d*<$/.test(operator)) {
    return true
  }
  if (/^\d*>&$/.test(operator) && /^\d+$/.test(target)) {
    return true
  }

  return target === '/dev/null'
}

/**
 * 引数が禁じた引数に当たるか
 * @param arg - 確かめる引数
 * @param option - 禁じた引数。`--x` は `--x=値` も、1 文字の `-x` は `-ax` のようにまとめた形も当たる
 * @returns 当たれば true
 */
function matchesOption(arg: string, option: string): boolean {
  if (arg === option) {
    return true
  }
  if (option.startsWith('--')) {
    return arg.startsWith(`${option}=`)
  }
  if (option.length === 2) {
    return /^-[^-]/.test(arg) && arg.includes(option.slice(1))
  }

  return false
}

/**
 * 引数のどれかが禁じた引数のどれかに当たるか
 * @param args - 確かめる引数
 * @param options - 禁じた引数
 * @returns 1 つでも当たれば true
 */
function hasOption(args: readonly string[], options: readonly string[]): boolean {
  return args.some(arg => options.some(option => matchesOption(arg, option)))
}

/**
 * gh のコマンドが読み取りだけか
 * @param args - gh に続く引数
 * @returns 読み取りのサブコマンドか、GET で済む gh api・mutation を含まない graphql の query なら true
 */
function isReadOnlyGh(args: readonly string[]): boolean {
  const [group, action, ...rest] = args
  if (group === 'status') {
    return true
  }
  if (group !== 'api') {
    return group !== undefined && action !== undefined && (READ_ONLY_GH_SUBCOMMANDS[group] ?? []).includes(action)
  }

  const apiArgs = action === undefined ? [] : [action, ...rest]
  if (apiArgs.length === 0 || hasOption(apiArgs, GH_API_FORBIDDEN_ARGS)) {
    return false
  }
  if (!hasOption(apiArgs, GH_API_FIELD_ARGS)) {
    return true
  }

  return apiArgs.includes('graphql') && !apiArgs.some(arg => /mutation/i.test(arg) || arg.includes('=@'))
}

/**
 * 1 つのコマンド（区切りの間）が読み取りだけか
 * @param words - コマンド名と引数
 * @returns 許可リストのコマンドで、禁じた引数を含まなければ true
 */
function isReadOnlySimpleCommand(words: readonly string[]): boolean {
  const [name, ...args] = words
  if (name === undefined || !READ_ONLY_COMMANDS.has(name)) {
    return false
  }

  const forbidden = FORBIDDEN_ARGS[name] ?? []
  if (args.some(arg => forbidden.some(option => matchesOption(arg, option)))) {
    return false
  }

  if (name === 'gh') {
    return isReadOnlyGh(args)
  }
  if (name === 'git') {
    const [subcommand] = args
    return subcommand !== undefined && READ_ONLY_GIT_SUBCOMMANDS.has(subcommand)
  }
  if (name === 'uniq') {
    return args.filter(arg => !arg.startsWith('-')).length <= 1
  }

  return true
}

/**
 * Bash のコマンドが読み取りだけで済むか。確かめられない書き方は読み取りとみなさない
 * @param command - Bash ツールに渡されたコマンド
 * @returns すべてのコマンドが許可リストにあり、ファイルへの書き出しが無ければ true
 */
export function isReadOnlyCommand(command: string): boolean {
  const tokens = tokenize(command)
  if (tokens === UNCHECKABLE) {
    return false
  }

  const commands: string[][] = [[]]
  for (const token of tokens) {
    if (token.kind === 'redirect') {
      if (!isHarmlessRedirect(token.operator, token.target)) {
        return false
      }
    } else if (token.kind === 'separator') {
      commands.push([])
    } else {
      commands[commands.length - 1]?.push(token.text)
    }
  }

  const nonEmpty = commands.filter(words => words.length > 0)
  return nonEmpty.length > 0 && nonEmpty.every(isReadOnlySimpleCommand)
}

/**
 * MCP ツールが名前から読み取り専用と言えるか。名前の最後の部分（`mcp__サーバー__ツール` のツール）を語に分けて判断する
 * @param tool - ツールの名前
 * @returns 読み取りの語を含み、書き込みや実行の語を含まなければ true
 */
export function isReadOnlyMcpTool(tool: string): boolean {
  const action = tool.split('__').at(-1) ?? ''
  const words = action
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)

  return words.some(word => MCP_READ_WORDS.has(word)) && !words.some(word => MCP_WRITE_WORDS.has(word))
}

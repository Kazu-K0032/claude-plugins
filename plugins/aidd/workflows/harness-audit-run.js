export const meta = {
  // リポジトリが、本マーケットプレイスの設計思想（AIDD × DocDD）と、そのリポジトリの規約に合うかを、
  // fan-out で網羅監査する workflow。init-repo からの作り直しの後や、統合ブランチへのマージ前の最終チェック（全体）と、
  // PR の前の確認（差分・ディレクトリ）に使う。
  // 機械チェック（リンク切れ・markdown 規約）は Lint の担当として重複させない。
  //
  // 対象の一覧と設計思想の要約（aidd の references/harness-principles.md の本文）と範囲は、/aidd:harness-audit スキルが args で渡す。
  // 範囲の絞り込み（差分・ディレクトリ）はスキル側で済ませてあり、ここでは files をそのまま対象にする。
  // scope は、レポートの注記に「範囲」と「見ていないもの」を書くためだけに使う。
  // 実行前に件数と体数の見込みを示して利用者の確認を取るのはスキル側（workflow からは利用者に質問できない）。
  // 出力は tmp/<branch>/harness-audit_<timestamp>.md のみ。修正は行わない。
  name: 'harness-audit-run',
  description:
    'リポジトリがマーケットプレイスの設計思想と規約に合うか（規約違反・価値に反する・規約のずれ・仕組みの欠け）と、ファイル間の値の矛盾・重複記述・参照方向違反を fan-out で監査し、各指摘を敵対的に検証して tmp/<branch>/harness-audit_<timestamp>.md に追記する。範囲は全体・差分・ディレクトリ。費用が大きいため直接は呼ばず、見込みを示して確認を取る /aidd:harness-audit から呼ぶ（args で { files, principles, scope, confirmed: true } を渡す）',
  // phases の model は進み具合の表示に使う。下の MODELS とそろえる（meta は純粋なリテラルのため、定数を参照できない）
  phases: [
    { title: 'Rubric', detail: '設計思想の要約とリポジトリの規約から、当てるファイル付きのチェックリストと規約のずれの候補を作る', model: 'opus' },
    { title: 'Presence', detail: 'init-repo の印があれば、土台の仕組みの欠けを判定して反証する', model: 'opus' },
    { title: 'Inspect', detail: '小さいファイルは束ねて、違反の候補と事実を抽出', model: 'sonnet' },
    { title: 'Detect', detail: '事実集合を横断突合し矛盾・重複・参照方向違反の候補を生成（多ければディレクトリの群ごと → 全体の 2 段）', model: 'opus' },
    { title: 'Verify', detail: '違反の候補は束ごと、規約のずれと横断の候補は1件ごとに敵対的に検証', model: 'opus' },
    { title: 'Report', detail: '確定指摘を重大度別に分け、推奨アクションを添えて tmp/<branch>/harness-audit_<timestamp>.md へ追記', model: 'sonnet' },
  ],
}

// --- 段ごとのモデルと effort ---
// 呼び出し元のモデルに任せると、費用が呼ぶ人のモデルで変わるため固定する。
// 規約の整理・欠けの判定・横断の突合・検証は判断の質が結果を決めるため、opus / high で質を落とさない（V1）。
// 各ファイルの検査は数が多いため sonnet にし、規約への適合の判断が入るぶん effort を上げる。誤検出は検証の段で落とす。
// モデルを変えたら、meta.phases の model も合わせて直す。
const MODELS = {
  rubric: { model: 'opus', effort: 'high' },
  presence: { model: 'opus', effort: 'high' },
  inspect: { model: 'sonnet', effort: 'high' },
  detect: { model: 'opus', effort: 'high' },
  verify: { model: 'opus', effort: 'high' },
  report: { model: 'sonnet', effort: 'medium' },
}

// --- 小さいファイルの束ね方 ---
// エージェントは 1 体ごとに共通の前提（指示・CLAUDE.md など）を読むため、体数がそのまま費用になる。
// 小さいファイルは束ねて 1 体で検査し、大きいファイルと大きさが分からないファイルは 1 件で 1 体にする。
const BATCH = { smallBytes: 8000, maxBytes: 32000, maxFiles: 8 }

// --- 横断の突合の分け方 ---
// 1 体が読む事実集合が大きすぎると取りこぼすため、これを超えたらディレクトリの群ごと → 全体の 2 段にする。
const DETECT_GROUP = { maxFiles: 60 }

// 1 つの workflow のエージェント数は合計 1,000 が上限。途中で当たって結果が欠ける前に止められるよう、
// 実行前に数えられる体数（横断の候補の検証を除く）がこれを超えたら実行しない。
const AGENT_LIMIT = 1000
const AGENT_PLAN_LIMIT = 900

// --- スキーマ定義（agent の構造化出力を強制する） ---

// Rubric: 判定に使う規約と、そこから作ったチェックリスト、規約のずれの候補
const RUBRIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rubrics', 'checklist', 'drift', 'hasReferenceDirectionRule', 'ssotTableFile'],
  properties: {
    rubrics: {
      type: 'array',
      items: { type: 'string' },
      description: '判定に使ったこのリポジトリの規約・方針・価値のファイルのパス（見つからなければ空配列）',
    },
    checklist: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'rule', 'appliesTo', 'source', 'basis', 'origin'],
        properties: {
          id: { type: 'string', description: '項目の識別子（規約は R1, R2…、価値は V1, V2…）' },
          rule: { type: 'string', description: 'ファイルの中身で確かめられる決まり（1〜2 文）' },
          appliesTo: {
            type: 'array',
            items: { type: 'string' },
            description: '当てるファイルの glob（*・**・? のみ。例: **/*.md, .claude/settings.json）',
          },
          source: { type: 'string', description: '出典のパスと見出し（同梱の思想なら「設計思想の要約」と見出し）' },
          basis: { type: 'string', enum: ['rule', 'value'], description: '具体的な決まりなら rule、価値・原則なら value' },
          origin: { type: 'string', enum: ['marketplace', 'repo'], description: '同梱の思想から取ったか、リポジトリの規約から取ったか' },
        },
      },
    },
    drift: {
      type: 'array',
      description: 'リポジトリの規約が、同梱の思想と食い違っている箇所の候補',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'files', 'detail'],
        properties: {
          topic: { type: 'string' },
          files: { type: 'array', items: { type: 'string' }, description: '食い違っている規約のファイル' },
          detail: { type: 'string', description: '規約のどの記述が、思想のどの文と食い違うか（思想の文を引用する）' },
        },
      },
    },
    hasReferenceDirectionRule: {
      type: 'boolean',
      description: '「ドキュメント階層の参照方向を一方向に固定する」旨の規約が実在するか',
    },
    ssotTableFile: {
      type: 'string',
      description: '情報→唯一の情報源の対応表を持つファイルのパス（無ければ空文字）',
    },
  },
}

// Presence: init-repo の印と、土台の仕組みの欠け
const PRESENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['harnessInstalled', 'marks', 'missing'],
  properties: {
    harnessInstalled: { type: 'boolean', description: '設計思想の要約の「init-repo の印」の条件を満たせば true' },
    marks: { type: 'array', items: { type: 'string' }, description: '見つかった印のパス' },
    missing: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['mechanism', 'severity', 'detail'],
        properties: {
          mechanism: { type: 'string', description: '欠けている仕組み（要約の「土台の仕組み」の名前）' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          detail: { type: 'string', description: 'どこを見て、何が無かったか' },
        },
      },
    },
  },
}

// Presence の反証: 欠けごとの判定
const PRESENCE_VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['mechanism', 'detail', 'isReal', 'severity', 'reason'],
        properties: {
          mechanism: { type: 'string' },
          detail: { type: 'string' },
          isReal: { type: 'boolean' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string' },
        },
      },
    },
  },
}

// Inspect: 1ファイルから抽出した、規約への違反の候補と、他ファイルと衝突し得る事実集合
const INSPECT_FILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['file', 'violations', 'facts', 'ssotOwned', 'referencesUp', 'suspectInlineDetail'],
  properties: {
    file: { type: 'string' },
    // チェックリストの項目に反している疑いのある箇所
    violations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ruleId', 'location', 'detail'],
        properties: {
          ruleId: { type: 'string' },
          location: { type: 'string', description: '行番号か、該当箇所の短い引用' },
          detail: { type: 'string', description: '何がどの決まりに反しているか' },
        },
      },
    },
    // 他ファイルと矛盾し得る具体値（ポート/バージョン/URL/パス/コマンド引数/件数 等）。コードはコメントと設定値から拾う
    facts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'value'],
        properties: {
          topic: { type: 'string', description: '値が指す対象（例: アプリのポート番号, 記事の件数）' },
          value: { type: 'string', description: '記載されている具体値' },
          unit: { type: 'string', description: '単位や補足（任意）' },
        },
      },
    },
    // このファイルが唯一の情報源として所有を主張している情報
    ssotOwned: { type: 'array', items: { type: 'string' } },
    // ドキュメント層から、より上位のツール・設定層を参照していたら true（参照方向違反の兆候）
    referencesUp: { type: 'boolean' },
    // README なのに手順・コマンド・設定値の詳細を本文に書いている箇所
    suspectInlineDetail: { type: 'array', items: { type: 'string' } },
  },
}

// Inspect: 束ねたファイルごとの結果
const INSPECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: { type: 'array', items: INSPECT_FILE_SCHEMA, description: '対象のファイルごとに 1 件' },
  },
}

// Verify（束ごと）: 束の中の違反の候補をまとめて判定した結果
const BATCH_VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'ruleId', 'location', 'detail', 'isReal', 'severity', 'reason'],
        properties: {
          file: { type: 'string' },
          ruleId: { type: 'string' },
          location: { type: 'string' },
          detail: { type: 'string' },
          isReal: { type: 'boolean' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string' },
        },
      },
    },
  },
}

// Detect: 横断突合で挙がった指摘候補
const CANDIDATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'topic', 'files', 'detail'],
  properties: {
    kind: { type: 'string', enum: ['contradiction', 'duplication', 'reference-direction'] },
    topic: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    detail: { type: 'string' },
  },
}
const DETECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: { type: 'array', items: CANDIDATE_SCHEMA },
  },
}

// Detect（群ごと）: 群の中の候補と、ほかの群との突合に回す要点の事実
const GROUP_DETECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates', 'keyFacts'],
  properties: {
    candidates: { type: 'array', items: CANDIDATE_SCHEMA },
    keyFacts: {
      type: 'array',
      description: 'ほかの群のファイルも書いていそうな事実（同じ値を持つファイルはまとめる）',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'value', 'files'],
        properties: {
          topic: { type: 'string' },
          value: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

// Verify（横断）: 候補が本物かの敵対的判定
const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isReal', 'severity', 'reason'],
  properties: {
    isReal: { type: 'boolean' },
    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
    reason: { type: 'string' },
  },
}

// Report: 書き出し先パス
const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['path'],
  properties: {
    path: { type: 'string', description: '実際に書き込んだレポートファイルの相対パス' },
  },
}

// --- チェックリストの項目をファイルに当てる ---
// appliesTo の glob（*・**・?）を正規表現にする。依存を足さずに済む範囲の小さな実装で、{a,b} は扱わない。
function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // **/ は 0 階層以上のディレクトリに当たる
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?'
          i += 2
        } else {
          re += '.*'
          i += 1
        }
      } else {
        re += '[^/]*'
      }
    } else if (c === '?') {
      re += '[^/]'
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp('^' + re + '$')
}

function applies(item, file) {
  return (item.appliesTo || []).some((g) => {
    // / を含まない glob（*.md など）は、どの階層のファイル名にも当てる
    const pattern = g.includes('/') ? g : '**/' + g
    try {
      return globToRegExp(pattern).test(file)
    } catch (e) {
      return false
    }
  })
}

// --- 束と群を作る ---
// パスの順に並べ、同じディレクトリのファイルが同じ束に入りやすくする。
function makeBatches(entries) {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const batches = []
  let cur = null
  for (const e of sorted) {
    const small = typeof e.bytes === 'number' && e.bytes <= BATCH.smallBytes
    if (!small) {
      batches.push([e.path])
      continue
    }
    if (!cur || cur.files.length >= BATCH.maxFiles || cur.bytes + e.bytes > BATCH.maxBytes) {
      cur = { files: [], bytes: 0 }
      batches.push(cur.files)
    }
    cur.files.push(e.path)
    cur.bytes += e.bytes
  }
  return batches
}

// ディレクトリの深さを 1 段ずつ下げて分け、それでも多ければ件数で切る。小さすぎる群は、隣の群とまとめる。
function makeGroups(paths) {
  const max = DETECT_GROUP.maxFiles
  const chunk = (list) => {
    const out = []
    for (let i = 0; i < list.length; i += max) out.push(list.slice(i, i + max))
    return out
  }
  const split = (list, depth) => {
    if (list.length <= max) return [list]
    const deepest = list.reduce((n, p) => Math.max(n, p.split('/').length), 0)
    if (depth >= deepest) return chunk(list)
    const byDir = new Map()
    for (const p of list) {
      const parts = p.split('/')
      // 深さ depth より浅いファイルは、親ディレクトリの直下のファイルとして 1 つにまとめる
      const key = parts.length > depth ? parts.slice(0, depth).join('/') : ''
      if (!byDir.has(key)) byDir.set(key, [])
      byDir.get(key).push(p)
    }
    if (byDir.size === 1) return split(list, depth + 1)
    return [...byDir.values()].flatMap((g) => split(g, depth + 1))
  }
  const sorted = [...paths].sort()
  const merged = []
  for (const g of split(sorted, 1)) {
    const last = merged[merged.length - 1]
    if (last && last.length + g.length <= max) last.push(...g)
    else merged.push([...g])
  }
  return merged
}

// --- 範囲の説明 ---
// 呼び出し元が絞り込んだ範囲（全体・差分・ディレクトリ）を、レポートの注記に書く文にする。
// 範囲の外のファイルは、規約違反を見ず、範囲の外との矛盾・重複も見つからないため、見ていないものとして書く。
// 規約のずれと仕組みの欠けは files に依らず、リポジトリの規約から見るため、範囲に関わらず全体を対象にする。
function parseScope(raw) {
  if (!raw || typeof raw !== 'object' || !['all', 'diff', 'dir'].includes(raw.kind)) return null
  return {
    kind: raw.kind,
    base: typeof raw.base === 'string' ? raw.base : '',
    paths: Array.isArray(raw.paths) ? raw.paths.filter((p) => typeof p === 'string' && p) : [],
    total: typeof raw.total === 'number' && raw.total >= 0 ? raw.total : null,
    markdownOnly: raw.markdownOnly === true,
  }
}

// count は実際に監査するファイル数。戻り値の range は「範囲」の行、unseen は「見ていないもの」の行（無ければ空文字）
function describeScope(scope, count) {
  if (!scope) return { range: `呼び出し元から渡されていない（渡された ${count} 件を対象にした）`, unseen: '' }
  const known = scope.total !== null && scope.total >= count
  const of = known ? `全 ${scope.total} 件のうち ${count} 件` : `${count} 件`
  const md = scope.markdownOnly ? '、markdown だけ' : ''
  let label
  if (scope.kind === 'diff') {
    label = `差分（${scope.base ? `${scope.base} との差` : '今のブランチの変更'}${md}。${of}）`
  } else if (scope.kind === 'dir') {
    label = `ディレクトリ（${scope.paths.join('・') || 'パス不明'}${md}。${of}）`
  } else {
    label = scope.markdownOnly ? `全体のうち markdown だけ（${of}）` : `全体（${count} 件）`
  }
  const narrowed = scope.kind !== 'all' || scope.markdownOnly
  const range = narrowed ? `${label}。規約のずれと仕組みの欠けは、範囲に関わらず全体を対象にする` : label
  const outside = known ? scope.total - count : null
  if (!narrowed || outside === 0) return { range, unseen: '' }
  const outsideText = outside === null ? '範囲の外のファイル' : `範囲の外の ${outside} 件`
  return {
    range,
    unseen: `${outsideText}の規約違反・価値に反する箇所と、範囲の外のファイルとの値の矛盾・重複記述・参照方向違反`,
  }
}

// --- args の解釈 ---
// { files: [{ path, bytes }] | [path], principles: <設計思想の要約の本文>, scope: { kind, base?, paths?, total?, markdownOnly? } } を受け取る。
// 文字列化された JSON で渡されても読めるようにする。
let input = args
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch (e) {
    input = null
  }
}
const entries = (input && Array.isArray(input.files) ? input.files : [])
  .map((f) => {
    if (typeof f === 'string') return { path: f, bytes: null }
    if (f && typeof f.path === 'string') return { path: f.path, bytes: typeof f.bytes === 'number' ? f.bytes : null }
    return null
  })
  .filter((f) => f && f.path)
const files = entries.map((e) => e.path)
const principles = input && typeof input.principles === 'string' ? input.principles.trim() : ''
const scope = parseScope(input && input.scope)
const scopeNote = describeScope(scope, files.length)

// 見込みを示して利用者の確認を取るのはスキル側。確認を通っていない呼び出しは、費用が大きいため走らせない
if (!input || input.confirmed !== true) {
  log('利用者の確認を経ていないため終了する。/aidd:harness-audit から呼ぶ（見込みを示して確認を取り、args に confirmed: true を渡す）')
  return { file: null, files: files.length, confirmed: 0, stopped: 'not-confirmed' }
}
if (files.length === 0) {
  log('対象のファイルが渡されていないため終了する。/aidd:harness-audit から呼ぶ（args の files に対象のパスを渡す）')
  return { file: null, files: 0, confirmed: 0, stopped: 'no-files' }
}

const batches = makeBatches(entries)
const groups = files.length <= DETECT_GROUP.maxFiles ? [files] : makeGroups(files)
const detectAgents = groups.length === 1 ? 1 : groups.length + 1
// Rubric 1・Presence 2・Inspect と束ごとの Verify が束の数ずつ・Detect・Report 1
const planned = 1 + 2 + batches.length * 2 + detectAgents + 1
if (planned > AGENT_PLAN_LIMIT) {
  log(
    `対象 ${files.length} ファイル（束 ${batches.length}・群 ${groups.length}）で、エージェントが ${planned} 体以上要る。` +
      `1 回の上限 ${AGENT_PLAN_LIMIT} を超えるため実行せずに終了する（途中で上限 ${AGENT_LIMIT} に当たり、結果が欠けるため）。対象を分けて呼ぶ`
  )
  return { file: null, files: files.length, confirmed: 0, stopped: 'too-many-agents' }
}
log(`対象 ${files.length} ファイル / 束 ${batches.length} / 横断の群 ${groups.length} / 横断の候補の検証を除くエージェント ${planned} 体`)
log(`範囲: ${scopeNote.range}`)
if (!principles) {
  log('設計思想の要約が渡されていないため、リポジトリの規約だけで見る。仕組みの欠けと規約のずれは見ない')
}

// --- 本体 ---

// 1. Rubric: 同梱の思想とリポジトリの規約から、各ファイルに渡せる大きさのチェックリストを作る。
//    規約のパスはリポジトリごとに違うため、固定せず探索させる。
//    見つからなかった観点は後段で「規約なし」として扱い、指摘を捏造させない。
phase('Rubric')
const rubric = await agent(
  [
    'このリポジトリを、本マーケットプレイスの設計思想と、このリポジトリの規約に当てるためのチェックリストを作れ。',
    '',
    ...(principles
      ? ['【設計思想の要約】（マーケットプレイスが同梱する物差し。origin=marketplace の項目の出典）', principles, '']
      : ['【設計思想の要約】渡されていない。origin=marketplace の項目と drift は作らない。', '']),
    '監査対象のファイル（appliesTo を決める参考にする）:',
    JSON.stringify(files),
    '',
    '【規約ファイルの特定】Glob / Grep で次を探し、実在したパスだけを rubrics に入れる。',
    '- Claude 向けの常時ルール: 任意の階層の `CLAUDE.md`・`AGENTS.md`、`.claude/rules/*.md`',
    '- 貢献・執筆の規約: `CONTRIBUTING.md`（`.github/` 配下も）、`docs/**/*style*.md` 等',
    '- 方針・価値・原則: `docs/policies/`・`docs/values/`・`docs/strategies/` 等、方針や価値を定めた文書',
    '- 情報と唯一の情報源の対応表: 「唯一の情報源」「SSOT」の列や見出しを持つ表',
    '- ドキュメント階層の参照方向を定めた規約: 「参照方向」「一方向」「逆流」等の語を含む記述',
    '',
    '【チェックリストの作り方】',
    '- 設計思想の要約の「価値」「利用先に効く方針」と、リポジトリの規約の両方から項目を作る。「土台の仕組み」と「init-repo の印」は別の段で見るため、項目にしない。',
    '- 同じ決まりが両方にあれば 1 項目にし、リポジトリの規約の側（origin=repo）を出典にする。',
    '- ファイルの中身で確かめられる決まりだけを入れる。操作の手順・会話での振る舞いなど、ファイルを読んでも確かめられないものは入れない。',
    '- 具体的な決まりは basis=rule、価値・原則（抽象的な考え方）は basis=value にする。',
    '- value の rule には、価値の文を短く引用し、ファイルのどんな書き方・作りがそれに反するかを書く。',
    '- appliesTo には当てるファイルの glob を書く。使える記号は *・**・? だけ（{a,b} は使わず、要素を分ける）。',
    '  `.claude/rules/*.md` の frontmatter に `paths:` があれば、それを appliesTo に使う。',
    '- source には出典のパスと見出しを書く（例: `.claude/rules/tmp-output.md` の「作業用のファイルを作る場合」、設計思想の要約の「利用先に効く方針」の P4）。',
    '- 1 項目は 1〜2 文にする。',
    '',
    '【規約のずれ（drift）】',
    principles
      ? '- リポジトリの規約が、設計思想の要約と食い違う箇所を挙げる（例: コミットを Claude に任せると書いた規約）。思想をより厳しくしているだけのものと、理由を残して意図的に変えているものは挙げない。'
      : '- 設計思想の要約が無いため、空配列を返す。',
    '',
    '判定結果:',
    '- ssotTableFile: 情報→唯一の情報源の対応表を持つファイルのパス。無ければ空文字。',
    '- hasReferenceDirectionRule: 「ドキュメント階層の参照は一方向に固定する（逆流は違反）」旨の規約が実在すれば true。',
    '  そういう規約が無いリポジトリでは false にする（推測で true にしないこと）。',
    '',
    '存在しないファイルを rubrics に入れてはならない。思想の要約にも規約ファイルにも無い一般論を、チェックリストに入れてはならない。',
  ].join('\n'),
  { label: 'rubric', phase: 'Rubric', schema: RUBRIC_SCHEMA, ...MODELS.rubric }
)
if (!rubric) {
  // 物差しが無いまま進めると、規約違反を一般論で挙げてしまうため止める
  log('チェックリストを作れなかったため終了する（エージェントの失敗・スキップ）')
  return { file: null, files: files.length, confirmed: 0, stopped: 'rubric-failed' }
}

const rubrics = rubric.rubrics || []
const checklist = rubric.checklist || []
const driftCandidates = principles ? (rubric.drift || []).map((d) => ({ kind: 'drift', ...d })) : []
const ssotTableFile = rubric.ssotTableFile || ''
const hasRefRule = !!rubric.hasReferenceDirectionRule
const itemsById = new Map(checklist.map((it) => [it.id, it]))
const itemsFor = (f) => checklist.filter((it) => applies(it, f))
const uncovered = files.filter((f) => itemsFor(f).length === 0)

log(
  `規約: ${rubrics.length ? rubrics.join(', ') : 'なし'}` +
    ` / チェックリスト: ${checklist.length} 項目（同梱の思想 ${checklist.filter((it) => it.origin === 'marketplace').length}・価値 ${checklist.filter((it) => it.basis === 'value').length}）` +
    ` / 規約のずれの候補: ${driftCandidates.length}` +
    `${ssotTableFile ? ` / SSOT 対応表: ${ssotTableFile}` : ' / SSOT 対応表なし'}` +
    `${hasRefRule ? '' : ' / 参照方向の規約なし（この観点はスキップ）'}`
)
if (uncovered.length > 0) {
  // 当てる項目が無いファイルも、横断の突合のために事実は抽出する。規約への適合は見ていないことを伝える
  log(`当てはまる規約が無いファイル: ${uncovered.length} 件（規約への適合は見ず、横断の突合にだけ使う）`)
}

// 規約が 1 つも無く、思想の要約も無いリポジトリでは、値の矛盾（客観的に判定できる観点）だけに絞る。
const rubricNote = rubrics.length
  ? `判定の前に、このリポジトリの規約を Read せよ: ${rubrics.join(' / ')}`
  : 'このリポジトリには明文化された規約が見つからなかった。値の矛盾（客観的に判定できるもの）に絞って判定し、規約違反としての指摘は挙げないこと。'

// 2. Presence: init-repo の土台の仕組みの欠けを見る。ファイルごとの検査と関係しないため、並行して走らせる。
//    欠けがあれば、別の 1 体が「別の形で役割を果たしていないか」を探して反証する。
const presencePromise = (async () => {
  if (!principles) return { installed: false, skipped: true, marks: [], verdicts: [], unchecked: [] }
  const found = await agent(
    [
      '次の設計思想の要約の「init-repo の印」と「土台の仕組み」に従い、このリポジトリの土台の欠けを判定せよ。',
      '',
      principles,
      '',
      '手順:',
      '1. 「init-repo の印」のパスを Glob で確かめ、見つかったものを marks に入れる。要約の条件を満たせば harnessInstalled=true。',
      '2. harnessInstalled=false なら、missing は空配列にして終える。',
      '3. true なら、「土台の仕組み」の表の行ごとに、手がかりのファイルを Read して役割を果たしているかを確かめる。',
      '   パスや書き方が違っても、役割を果たしていれば欠けにしない（例: 別の名前のフックで破壊的な操作を止めている）。',
      '4. 果たしていない仕組みを missing に入れる。severity は表の重大度をそのまま使う。detail には、どこを見て何が無かったかを書く。',
      '',
      '技術別のスキル（gas・terraform・wordpress）が足すものは見ない。ファイルの修正はしない。',
    ].join('\n'),
    { label: 'presence', phase: 'Presence', schema: PRESENCE_SCHEMA, ...MODELS.presence }
  )
  // 判定の段が止まったときは、「土台が無い」と取り違えないよう failed を立てる
  if (!found) return { installed: false, skipped: true, failed: true, marks: [], verdicts: [], unchecked: [] }
  const missing = found.missing || []
  if (!found.harnessInstalled || missing.length === 0) {
    return { installed: !!found.harnessInstalled, skipped: false, marks: found.marks || [], verdicts: [], unchecked: [] }
  }
  const checked = await agent(
    [
      '次の「土台の仕組みの欠け」を敵対的に検証せよ。別の形で役割を果たしていれば isReal=false にする。',
      '',
      '欠けの候補（JSON）:',
      JSON.stringify(missing),
      '',
      '設計思想の要約（「土台の仕組み」の表が基準）:',
      principles,
      '',
      '手順:',
      '1. 候補ごとに、同じ役割を果たす別の設定・フック・CI・規約が無いかを Glob / Grep / Read で探す。',
      '2. 見つかれば isReal=false。見つからなければ isReal=true にする。',
      '3. severity は表の重大度を使う。low の欠けは、reason の最後に「意図して入れていないなら無視してよい」と添える。',
      '',
      '候補ごとに 1 件の verdict を返す（mechanism・detail は候補のまま写す）。',
    ].join('\n'),
    { label: 'verify:presence', phase: 'Verify', schema: PRESENCE_VERDICT_SCHEMA, ...MODELS.verify }
  )
  if (!checked) {
    // 反証の段が止まったときは、欠けを黙って落とさず、確かめられなかったものとしてレポートに出す
    return { installed: true, skipped: false, marks: found.marks || [], verdicts: [], unchecked: missing }
  }
  // 候補に無い仕組みの返事は捨てる。返事の無い欠けは、黙って落とさず反証できなかったものに入れる
  const names = new Set(missing.map((m) => m.mechanism))
  const verdicts = (checked.verdicts || [])
    .filter((v) => names.has(v.mechanism))
    .map((v) => ({
      ...v,
      kind: 'missing',
      files: [],
      topic: v.mechanism,
      source: '設計思想の要約の「土台の仕組み」',
    }))
  const answered = new Set(verdicts.map((v) => v.mechanism))
  const unchecked = missing.filter((m) => !answered.has(m.mechanism))
  return { installed: true, skipped: false, marks: found.marks || [], verdicts, unchecked }
})()

// 3. Inspect → Verify（束ごと）: pipeline。小さいファイルは束ねて 1 体で精読し、
//    違反の候補があれば、その束の検査が終わりしだい 1 体でまとめて検証する。
//    事実はフルテキストではなく圧縮して後段に渡し、Detect の "Lost in the middle" を緩和する。
phase('Inspect')
const perBatch = await pipeline(
  batches,
  (batch) => {
    const targets = batch.map((f) => ({ file: f, items: itemsFor(f).map((it) => it.id) }))
    const items = checklist.filter((it) => targets.some((t) => t.items.includes(it.id)))
    return agent(
      [
        `次の ${batch.length} 件のファイルを精読し、ファイルごとに構造化して抽出せよ。results にはファイルごとに 1 件ずつ返す。`,
        '',
        '対象のファイルと、そのファイルに当てるチェックリストの項目の id:',
        ...targets.map((t) => `- ${t.file}: ${t.items.length ? t.items.join(', ') : '（当てる項目なし）'}`),
        '',
        ...(items.length ? ['チェックリストの項目（JSON）:', JSON.stringify(items), ''] : []),
        '- violations: そのファイルに当てる項目に反している疑いのある箇所。疑いが強ければ確証が無くても挙げてよい（後段で検証する）。項目に無い一般論では挙げない。当てる項目が無いファイルは空配列。',
        '- facts: 他ファイルと矛盾し得る具体値（ポート/バージョン/URL/パス/コマンド引数/件数など）。本文に明示された値のみ。コード・設定のファイルは、コメントと設定値から拾う。',
        '- ssotOwned: そのファイルが唯一の情報源として所有を主張している情報（コード・設定のファイルは空配列）。',
        hasRefRule
          ? '- referencesUp: そのファイルがドキュメント層（docs/ 等）にありながら、ツール・設定層（`.claude/` 配下等）を参照していたら true。ドキュメント層以外なら false。'
          : '- referencesUp: このリポジトリには参照方向の規約が無いため、常に false を返す。',
        '- suspectInlineDetail: README なのに手順・コマンド・設定値の詳細を本文へ直書きしている箇所（README 以外なら空配列）。',
      ].join('\n'),
      { label: `inspect:${batch[0]}${batch.length > 1 ? ` +${batch.length - 1}` : ''}`, phase: 'Inspect', schema: INSPECT_SCHEMA, ...MODELS.inspect }
    )
  },
  async (inspected, batch) => {
    if (!inspected) return null
    // 頼んでいないファイルの結果は捨て、同じファイルの結果は 1 件にする
    const byFile = new Map()
    for (const r of inspected.results || []) {
      if (batch.includes(r.file) && !byFile.has(r.file)) byFile.set(r.file, r)
    }
    const results = [...byFile.values()]
    const candidates = results.flatMap((r) => (r.violations || []).map((v) => ({ file: r.file, ...v })))
    if (candidates.length === 0) return { results, verdicts: [], failed: 0 }
    const items = [...new Set(candidates.map((c) => c.ruleId))].map((id) => itemsById.get(id)).filter(Boolean)
    const checked = await agent(
      [
        '次のファイルについて挙がった、規約・思想への違反の候補を敵対的に検証せよ。',
        '確証が持てなければ isReal=false を既定とする。候補ごとに 1 件の verdict を返す（file・ruleId・location・detail は候補のまま写す）。',
        '',
        '違反の候補（JSON）:',
        JSON.stringify(candidates),
        '',
        '候補が根拠にしているチェックリストの項目（JSON）:',
        JSON.stringify(items),
        ...(principles && items.some((it) => it.origin === 'marketplace')
          ? ['', '設計思想の要約（origin=marketplace の項目の出典）:', principles]
          : []),
        '',
        '手順:',
        '1. 対象のファイルを Read する。',
        '2. 各項目の出典を読み、項目の要約ではなく原文で決まりを確かめる（リポジトリの規約は Read、同梱の思想は上の要約）。',
        '3. 本当にその決まりに反しているかを判定する。',
        '',
        '誤検出として除外すべきもの:',
        '- その決まりが、このファイルには当てはまらないもの（対象外の種類・場所のファイル）',
        '- 規約・テンプレート自身が、例（NG 例・プレースホルダなど）として書いている箇所',
        '- 出典に例外・当てはまらない場面として書かれているもの',
        '- 出典の原文に無い根拠による指摘（「一般にこうすべき」だけを根拠にしたもの）',
        '- 価値（basis=value）を根拠にした候補で、価値の文と箇所の食い違いを具体的に説明できないもの',
        '',
        'severity は影響度（high=実害/誤誘導, medium=保守性低下, low=軽微）で付けること。',
        'reason には、ファイルのどの記述が、出典のどの文に反するかを具体的に書くこと。',
      ].join('\n'),
      { label: `verify:rules:${batch[0]}${batch.length > 1 ? ` +${batch.length - 1}` : ''}`, phase: 'Verify', schema: BATCH_VERDICT_SCHEMA, ...MODELS.verify }
    )
    // 検証の段が止まったときは、候補を黙って落とさず、検証できなかった件数として数える
    if (!checked) return { results, verdicts: [], failed: candidates.length }
    // 返事を候補と突き合わせる。ファイルと項目の組ごとに、返事が候補より少なければ、足りない分を検証できなかった件数に数える。
    // location は書き写すときに揺れやすいため、組の単位で数える。候補に無い組の返事は捨てる
    const pairKey = (x) => `${x.file}\u0000${x.ruleId}`
    const asked = new Map()
    for (const c of candidates) asked.set(pairKey(c), (asked.get(pairKey(c)) || 0) + 1)
    const answeredCount = new Map()
    const verdicts = (checked.verdicts || [])
      .filter((v) => asked.has(pairKey(v)))
      .map((v) => {
        answeredCount.set(pairKey(v), (answeredCount.get(pairKey(v)) || 0) + 1)
        const item = itemsById.get(v.ruleId)
        return {
          ...v,
          kind: item && item.basis === 'value' ? 'value' : 'rule',
          files: [v.file],
          topic: item ? item.rule : v.ruleId,
          source: item ? item.source : '',
        }
      })
    let failed = 0
    for (const [k, n] of asked) failed += Math.max(0, n - (answeredCount.get(k) || 0))
    return { results, verdicts, failed }
  }
)

const done = perBatch.filter(Boolean)
const inspections = done.flatMap((b) => b.results)
const ruleVerdicts = done.flatMap((b) => b.verdicts)
const ruleFailed = done.reduce((n, b) => n + b.failed, 0)
const notInspected = files.length - inspections.length
const ruleCandidates = inspections.reduce((n, x) => n + (x.violations || []).length, 0)
if (notInspected > 0) {
  log(`検査できなかったファイル: ${notInspected} 件（エージェントの失敗・スキップ・結果の欠け）`)
}
log(`規約・思想への違反の候補: ${ruleCandidates} 件 / 確定 ${ruleVerdicts.filter((v) => v.isReal).length} 件`)

// 4. Detect: barrier 正当。横断比較は全抽出が揃って初めて成立するため、ここだけ集約する。
//    渡すのは圧縮済み事実集合のみ（フルテキスト・違反の候補は渡さない）。
//    多いときは、ディレクトリの群ごとに突き合わせてから、群が返した要点の事実を全体で突き合わせる。
phase('Detect')
const factSet = (x) => ({
  file: x.file,
  facts: x.facts,
  ssotOwned: x.ssotOwned,
  referencesUp: x.referencesUp,
  suspectInlineDetail: x.suspectInlineDetail,
})
const kindLines = [
  '- contradiction: 同一トピックに複数ファイルが異なる値を記載している矛盾。コードのコメントや設定値と、ドキュメントの記述の食い違いも含める',
  ssotTableFile
    ? '- duplication: 同じ手順・設定値が複数ファイルに重複記述されている（対応表の所有者以外が本文に書いている場合）'
    : '- duplication: 同じ手順・設定値が複数ファイルに実質同内容で重複記述されている（どちらが正か判断できない状態になっているもの）',
  hasRefRule
    ? '- reference-direction: ドキュメント層から上位層への逆参照（referencesUp=true のファイル）'
    : '- reference-direction: このリポジトリには参照方向の規約が無いため、この種別の候補は挙げない',
]
const detectRules = [
  '確実な候補のみ挙げ、各候補に関与ファイルを files として明記すること。',
  '規約ファイルが見つからなかった観点について、一般論を根拠に「違反」として挙げてはならない。',
]
const ssotLine = ssotTableFile ? `情報と唯一の情報源の対応表は ${ssotTableFile} にある。所有者の判定にはこれを使う。` : ''
const inspectedByFile = new Map(inspections.map((x) => [x.file, x]))

let crossCandidates = []
// 突合の段が止まったとき、横断の候補が 0 件に見えないよう、止まった数を数えてレポートに出す
let detectFailed = 0
if (groups.length === 1) {
  const detect = await agent(
    [
      `次は ${inspections.length} 個のファイルから抽出した事実集合（JSON）。`,
      '',
      JSON.stringify(inspections.map(factSet)),
      '',
      rubricNote,
      ssotLine,
      '',
      'その上で、ファイル間の指摘候補を列挙せよ:',
      ...kindLines,
      '',
      ...detectRules,
    ]
      .filter(Boolean)
      .join('\n'),
    { label: 'detect', phase: 'Detect', schema: DETECT_SCHEMA, ...MODELS.detect }
  )
  if (!detect) detectFailed = 1
  crossCandidates = (detect && detect.candidates) || []
} else {
  const perGroup = (
    await parallel(
      groups.map((g, i) => () =>
        agent(
          [
            `次は、全体を ${groups.length} 群に分けたうちの第 ${i + 1} 群（${g.length} ファイル）から抽出した事実集合（JSON）。`,
            '',
            JSON.stringify(g.map((f) => inspectedByFile.get(f)).filter(Boolean).map(factSet)),
            '',
            rubricNote,
            ssotLine,
            '',
            'この群の中のファイル間の指摘候補を candidates に列挙せよ:',
            ...kindLines,
            '',
            ...detectRules,
            '',
            'あわせて、ほかの群のファイルも書いていそうな事実（版・パス・件数・コマンド・設定値・規約の要点など）を keyFacts に入れる。同じ値を持つファイルは 1 件にまとめる。',
          ]
            .filter(Boolean)
            .join('\n'),
          { label: `detect:group-${i + 1}`, phase: 'Detect', schema: GROUP_DETECT_SCHEMA, ...MODELS.detect }
        )
      )
    )
  ).filter(Boolean)
  detectFailed = groups.length - perGroup.length
  const keyFacts = perGroup.map((r, i) => ({ group: i + 1, keyFacts: r.keyFacts || [] }))
  const global = await agent(
    [
      `次は、${perGroup.length} 群のそれぞれから取り出した要点の事実（JSON）。群の中の突合は済んでいる。`,
      '',
      JSON.stringify(keyFacts),
      '',
      rubricNote,
      ssotLine,
      '',
      '群をまたぐ指摘候補だけを列挙せよ（同じ群の中だけで閉じる候補は挙げない）:',
      ...kindLines,
      '',
      ...detectRules,
    ]
      .filter(Boolean)
      .join('\n'),
    { label: 'detect:global', phase: 'Detect', schema: DETECT_SCHEMA, ...MODELS.detect }
  )
  if (!global) detectFailed += 1
  crossCandidates = [...perGroup.flatMap((r) => r.candidates || []), ...((global && global.candidates) || [])]
}
if (detectFailed > 0) {
  log(`横断の突合が止まった段: ${detectFailed} 体（エージェントの失敗・スキップ）。その分の矛盾・重複は見ていない`)
}
log(`横断の指摘候補: ${crossCandidates.length} 件 / 規約のずれの候補: ${driftCandidates.length} 件`)

// 5. Verify（横断・規約のずれ）: fan-out。候補ごとに敵対的検証し、誤検出を落とす。
//    エージェント数の上限に当たらないよう、残りの枠を超えた候補は検証せず、件数を伝える（黙って落とさない）。
phase('Verify')
const allCross = [...driftCandidates, ...crossCandidates]
const crossBudget = Math.max(0, AGENT_LIMIT - planned - 5)
const toVerify = allCross.slice(0, crossBudget)
const unverified = allCross.slice(crossBudget)
if (unverified.length > 0) {
  log(`エージェント数の上限のため、${unverified.length} 件の候補を検証していない（レポートに件数を書く）。対象を分けて呼び直す`)
}
const buildCrossPrompt = (c) =>
  c.kind === 'drift'
    ? [
        '次の「規約のずれ」の候補を敵対的に検証せよ。確証が持てなければ isReal=false を既定とする。',
        '',
        JSON.stringify(c),
        '',
        '設計思想の要約（基準）:',
        principles,
        '',
        '手順:',
        '1. 候補の files（リポジトリの規約）を実際に Read する。',
        '2. 規約の記述が、要約のどの文と食い違うかを原文で確かめる。',
        '',
        '誤検出として除外すべきもの:',
        '- 思想をより厳しくしているだけの規約（ずれではない）',
        '- 理由を残して意図的に変えている規約（V4 を満たしている）',
        '- 要約の「当てはまらない場面」に当たるもの',
        '',
        'severity は影響度（high=安全や判断の線引きが崩れる, medium=保守性低下, low=軽微）で付けること。',
        'reason には、規約のどの記述が、要約のどの文と食い違うかを具体的に書くこと。',
      ].join('\n')
    : [
        '次の指摘候補を敵対的に検証せよ。確証が持てなければ isReal=false を既定とする。',
        '',
        JSON.stringify(c),
        '',
        '手順:',
        '1. 関与ファイル（候補の files）を実際に Read する。',
        `2. ${rubricNote}`,
        '3. 本当に矛盾/重複/逆参照が成立するか判定する。',
        '',
        '誤検出として除外すべきもの:',
        '- 別トピックを同一視した取り違え',
        '- 唯一の情報源へリンクで参照しているだけの正当な記述（重複ではない）',
        '- 案内板・目次としての README や索引ファイルの要約（重複記述として扱わない慣行が一般的）',
        '- 規約ファイルに実在しない根拠による指摘（「一般にこうすべき」だけを根拠にしたもの）',
        '',
        'severity は影響度（high=実害/誤誘導, medium=保守性低下, low=軽微）で付けること。',
        'reason には、どのファイルのどの記述が何と食い違うかを具体的に書くこと。',
      ].join('\n')
const crossVerdicts = (
  await parallel(
    toVerify.map((c) => () =>
      agent(buildCrossPrompt(c), {
        label: `verify:${c.kind}:${c.topic}`,
        phase: 'Verify',
        schema: VERDICT_SCHEMA,
        ...MODELS.verify,
      }).then((v) => (v ? { ...c, ...v } : null))
    )
  )
).filter(Boolean)
const crossFailed = toVerify.length - crossVerdicts.length

const presence = await presencePromise
// 仕組みの欠けを見たかを 1 語で返す。判定の段が止まったときを「土台が無い」と取り違えないため
const presenceStatus = presence.failed
  ? 'failed'
  : presence.skipped
    ? 'no-principles'
    : presence.installed
      ? 'checked'
      : 'not-installed'
if (presence.failed) {
  log('仕組みの欠けを判定する段が止まったため、欠けは見ていない。再実行する')
} else if (presence.skipped) {
  log('設計思想の要約が無いため、仕組みの欠けは見ていない')
} else if (!presence.installed) {
  log(`init-repo の印が条件に足りないため、仕組みの欠けは見ていない（見つかった印: ${presence.marks.length ? presence.marks.join(', ') : 'なし'}）`)
} else {
  log(`仕組みの欠け: 確定 ${presence.verdicts.filter((v) => v.isReal).length} 件`)
}
const uncheckedMissing = presence.unchecked.map((m) => `${m.mechanism}（${m.severity}）`)
if (uncheckedMissing.length > 0) {
  log(`反証できなかった仕組みの欠け: ${uncheckedMissing.join('、')}（レポートに書く）`)
}

// 途中のエージェントが止まって検証できなかった候補を数える。黙って落とすと、全件見たように読めるため
const failedCount = ruleFailed + crossFailed
if (failedCount > 0) {
  log(`検証の段が止まり、検証できなかった候補: ${failedCount} 件（レポートに件数を書く）`)
}

const confirmed = [...presence.verdicts, ...ruleVerdicts, ...crossVerdicts].filter((v) => v.isReal)
const candidateCount = ruleCandidates + allCross.length + presence.verdicts.length + presence.unchecked.length
log(`確定指摘: ${confirmed.length} / 候補 ${candidateCount}`)

// 6. Report: 確定指摘を重大度別に分け、直す順の推奨アクションを添えた Markdown に整形し、tmp/<branch>/harness-audit_<timestamp>.md へ追記する。
//    実行ごとの塊の構成と書き方の正典は aidd の references/report-format.md（docs-sync・pr-review と共通）。
//    workflow からはファイルを読めないため、下のレポート本文の要件に写して持つ。正典を変えたら、ここもそろえて直す。
//    workflow スクリプト内では時刻取得が禁止（Date.now/new Date は throw）のため、
//    ブランチ名とタイムスタンプの算出・パス組み立てはエージェントに Bash で行わせる。
//    ブランチ名の / を - に置換する規約は aidd の README.md の「ブランチ名の / は - に置き換える」。
//    検出のみ。問題の自動修正はしない。
phase('Report')
const presenceNote = {
  failed: '判定の段が止まったため見ていない（再実行する）',
  'no-principles': '設計思想の要約が無いため見ていない',
  checked: '見た',
  'not-installed': 'init-repo の土台が見つからないため見ていない',
}[presenceStatus]
const report = await agent(
  [
    '次の確定済み指摘を Markdown レポートに整形し、所定のファイルへ追記せよ。',
    '',
    '【書き出し先の決定】',
    '- Bash で現在ブランチ名を取得する: git rev-parse --abbrev-ref HEAD',
    '- Bash でタイムスタンプを取得する（時分秒）: date +%Y%m%d_%H%M%S',
    '- パスは tmp/<branch>/harness-audit_<timestamp>.md とする。ブランチ名に / が含まれる場合は - に置換する。',
    '- mkdir -p tmp/<branch> でディレクトリを作成する。',
    '- 既存ファイルがあれば追記（先頭を上書きしない）、なければ新規作成する。',
    '- 書き込んだ相対パスを path として返す。',
    '',
    `- 監査対象ファイル数: ${files.length}`,
    `- 設計思想の要約: ${principles ? '同梱のものを使った' : '使っていない'}`,
    `- 参照した規約: ${rubrics.length ? rubrics.join(', ') : 'なし'}`,
    `- 範囲: ${scopeNote.range}`,
    `- 範囲の外で見ていないもの: ${scopeNote.unseen || 'なし'}`,
    `- 当てはまる規約が無かったファイル数: ${uncovered.length}`,
    `- 仕組みの欠け: ${presenceNote}`,
    `- 参照方向の観点: ${hasRefRule ? '有効' : '規約が無いためスキップ'}`,
    `- 検証していない候補数（エージェント数の上限のため）: ${unverified.length}`,
    `- 検証できなかった候補数（検証の段が止まったため）: ${failedCount}`,
    `- 検査できなかったファイル数（検査の段が止まったため）: ${notInspected}`,
    `- 止まった横断の突合の段: ${detectFailed}`,
    `- 反証できなかった仕組みの欠け: ${uncheckedMissing.length ? uncheckedMissing.join('、') : 'なし'}`,
    `- 指摘候補数: ${candidateCount}`,
    `- 確定指摘数: ${confirmed.length}`,
    '',
    '確定指摘（JSON）。kind は rule=規約違反、value=価値に反する、drift=規約のずれ、missing=仕組みの欠け、contradiction=値の矛盾、duplication=重複記述、reference-direction=参照方向違反:',
    JSON.stringify(confirmed),
    '',
    '【レポート本文の要件】',
    '- ファイル新規作成時のみ、先頭に「# harness-audit 実行結果」の H1 を置く（追記時は付けない）。',
    '- 追記する塊の先頭に「## 監査 <timestamp>（branch: <branch>）」の見出しを付け、いつの結果か分かるようにする。',
    `- その直下に、次の冒頭の文をそのまま書く: 「この監査は、harness-audit によって、本マーケットプレイスの設計思想とこのリポジトリの規約への適合、土台の仕組みの欠け、ファイル間の整合性（値の矛盾・重複記述・参照方向違反）の観点から、${files.length} 件のファイルに問題が無いかチェックし結果をレポートしたものです。」`,
    '- 冒頭の文の直後に、引用（>）の注記を書く（何を見て何を見ていないかを明示する）。',
    '  - 「参照した規約：…」（上の「参照した規約」から。設計思想の要約を使ったなら「同梱の設計思想の要約」も並べる。無ければ「なし」）',
    '  - 「範囲：…」（上の「範囲」をそのまま書く）',
    '  - 「見ていないもの：…」（上の「範囲の外で見ていないもの」が「なし」なら、この行は書かない。範囲を絞ったときは、見つからないだけで無いとは限らないと添える）',
    '  - 「仕組みの欠け：…」（上の「仕組みの欠け」が「見た」なら、この行は書かない）',
    '  - 「規約を当てなかったファイル：…件」（上の件数が 0 なら、この行は書かない）',
    '  - 「検証していない候補：…件。対象を分けて再実行する」（上の件数が 0 なら、この行は書かない）',
    '  - 「途中で止まった段：検証できなかった候補 …件・検査できなかったファイル …件・横断の突合 …体。再実行する」（3 つとも 0 なら、この行は書かない。0 の項目は省く）',
    '  - 「反証できなかった仕組みの欠け：…。欠けているかを人が確かめる」（「なし」なら、この行は書かない）',
    '  - 「スキップした観点：…」（参照方向の観点が有効なら、この行は書かない）',
    '  - 「範囲：リンク切れ・markdown 規約などの機械チェックは Lint の担当。この監査は設計思想・規約への適合と横断的な意味の整合を扱う」',
    '- 注記の後に、次の見出しをこの順で置く: 「### high」「### medium」「### low」「### 推奨アクション」。severity ごとに指摘を分ける。',
    '- 各指摘は「対象ファイル / 種別 / 内容(detail) / 根拠(reason)」を含める。種別は上の日本語名で書く。rule・value・missing は、出典（source）も書く。仕組みの欠けの対象ファイルは「（無し）」と書く。',
    '- value（価値に反する）と drift（規約のずれ）の指摘は解釈を含むため、根拠に価値・思想の文の引用を入れる。',
    '- 指摘が無い見出しには「なし」と 1 行書く。確定指摘が 0 件なら、4 つの見出しとも「なし」にする。',
    '- 推奨アクションは、直す順に番号を付けて 1 行ずつ書く。最大 5 件。high の指摘から先に並べ、対象ファイルと、何を直すかを書く。同じ原因の指摘は 1 項目にまとめる。規約のずれは「規約を思想に合わせる」か「意図した変更なら理由を残す」かを書く。',
    '- markdown 規約（見出し前後の空行・コードブロックの言語指定など）に従う。',
    '',
    '【禁止】',
    '- ファイルの修正は行わない。レポート出力のみに留める。',
    '- 監査対象ファイルへの Write / Edit をしない。',
  ].join('\n'),
  { label: 'report', phase: 'Report', schema: REPORT_SCHEMA, ...MODELS.report }
)

// レポートの段が止まっても、件数は呼び出し元に返す
if (!report) log('レポートを書けなかった（エージェントの失敗・スキップ）。件数は戻り値で確かめる')
return {
  file: report ? report.path : null,
  files: files.length,
  batches: batches.length,
  groups: groups.length,
  rubrics,
  principles: !!principles,
  scope: scope ? scope.kind : null,
  checklist: checklist.length,
  uncovered: uncovered.length,
  harnessInstalled: presence.installed,
  presence: presenceStatus,
  referenceDirectionChecked: hasRefRule,
  candidates: candidateCount,
  unverified: unverified.length,
  failed: failedCount,
  notInspected,
  detectFailed,
  uncheckedMissing: uncheckedMissing.length,
  confirmed: confirmed.length,
}

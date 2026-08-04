export const meta = {
  // ドキュメント間の意味的整合性を fan-out で網羅監査する workflow。
  // 機械チェック（リンク切れ・markdown 規約）は Lint の担当として重複させず、
  // 単一 LLM では取りこぼしやすい「横断的な値の矛盾・重複記述・参照方向違反」だけを担う。
  //
  // 出力は tmp/<branch>/docs-report_<timestamp>.md のみ。修正は行わない。
  name: 'docs-consistency-audit',
  description:
    'ドキュメント間の唯一の情報源（SSOT）違反・値の矛盾・参照方向違反を fan-out で網羅監査し、各指摘を敵対的に検証して tmp/<branch>/docs-report_<timestamp>.md に追記する（全ドキュメントを横断する監査。args で { files: [...] } を渡せば対象を限定できる）',
  phases: [
    { title: 'Discover', detail: 'git 追跡中のドキュメント markdown と規約ファイルを列挙' },
    { title: 'Extract', detail: '1ファイル=1エージェントで事実・SSOT所有情報・参照を抽出' },
    { title: 'Detect', detail: '圧縮済み事実集合を横断突合し矛盾・重複・参照方向違反の候補を生成' },
    { title: 'Verify', detail: '候補ごとに規約へ照らして敵対的検証し誤検出を除去' },
    { title: 'Report', detail: '確定指摘を重大度別に tmp/<branch>/docs-report_<timestamp>.md へ追記' },
  ],
}

// --- スキーマ定義（agent の構造化出力を強制する） ---

// Discover: 監査対象ファイルと、判定に使う規約ファイルの一覧
const DISCOVER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['files', 'rubrics', 'hasReferenceDirectionRule'],
  properties: {
    files: { type: 'array', items: { type: 'string' }, description: '監査対象のドキュメントパス' },
    rubrics: {
      type: 'array',
      items: { type: 'string' },
      description: '判定に使えるこのリポジトリの規約ファイルのパス（見つからなければ空配列）',
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

// Extract: 1ファイルから抽出した、他ファイルと衝突し得る事実集合
const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['file', 'facts', 'ssotOwned', 'referencesUp', 'suspectInlineDetail'],
  properties: {
    file: { type: 'string' },
    // 他ファイルと矛盾し得る具体値（ポート/バージョン/URL/パス/コマンド引数/件数 等）
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

// Detect: 横断突合で挙がった指摘候補
const DETECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'topic', 'files', 'detail'],
        properties: {
          kind: { type: 'string', enum: ['contradiction', 'duplication', 'reference-direction'] },
          topic: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          detail: { type: 'string' },
        },
      },
    },
  },
}

// Verify: 候補が本物かの敵対的判定
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

// --- 監査対象の探索コマンド ---
// ドキュメントの置き場所はリポジトリごとに違うため、よくある候補をまとめて拾う。
//   1つ目の条件: docs/ doc/ documentation/ 配下のすべての markdown
//   2つ目の条件: 任意の階層にある README / CLAUDE / CONTRIBUTING / AGENTS
//     （サブディレクトリの案内板 README も監査対象に含める。ルート限定だと取りこぼす）
// ビルド成果物・依存パッケージ・一時ファイルは除外する。
const DISCOVER_CMD = [
  'git ls-files \\',
  "  | grep -E '\\.md$' \\",
  "  | grep -E '^(docs?|documentation)/|(^|/)(README|CLAUDE|CONTRIBUTING|AGENTS)\\.md$' \\",
  "  | grep -vE '(^|/)(node_modules|vendor|dist|build|tmp)/'",
].join('\n')

// --- args の解釈 ---
// { files: [...] } で対象を明示指定できる（試走・限定実行のショートカット）。
let argFiles = null
if (args && Array.isArray(args.files) && args.files.length > 0) {
  argFiles = args.files
}

// --- 本体 ---

// 1. Discover: 監査対象と、判定に使う規約を同時に特定する。
//    規約のパスはリポジトリごとに違うため、固定せず探索させる。
//    見つからなかった観点は後段で「規約なし」として扱い、指摘を捏造させない。
phase('Discover')
const discovered = await agent(
  [
    argFiles
      ? '監査対象は呼び出し側から与えられている。このリポジトリの「規約ファイル」の特定だけを行え。'
      : '監査対象のドキュメントと、判定に使うこのリポジトリの規約ファイルを特定せよ。',
    '',
    ...(argFiles
      ? [`files には次をそのまま入れる（加工しない）:`, JSON.stringify(argFiles), '']
      : [
          '【監査対象の列挙】次のコマンドをリポジトリルートで実行し、出力行をそのまま files 配列に入れる。',
          '加工・取捨選択はしないこと。',
          '',
          DISCOVER_CMD,
          '',
        ]),
    '【規約ファイルの特定】Glob / Grep で次を探し、実在したパスだけを rubrics に入れる。',
    '- ドキュメント執筆規約（重複排除・文体・構造）: `.claude/rules/*.md`・`CONTRIBUTING.md`・`docs/**/*style*.md` 等',
    '- 情報と唯一の情報源の対応表: `CLAUDE.md`・`docs/README.md` 等に「唯一の情報源」「SSOT」の列や見出しを持つ表',
    '- ドキュメント階層の参照方向を定めた規約: 「参照方向」「一方向」「逆流」等の語を含む記述',
    '',
    '判定結果:',
    '- ssotTableFile: 情報→唯一の情報源の対応表を持つファイルのパス。無ければ空文字。',
    '- hasReferenceDirectionRule: 「ドキュメント階層の参照は一方向に固定する（逆流は違反）」旨の規約が実在すれば true。',
    '  そういう規約が無いリポジトリでは false にする（推測で true にしないこと）。',
    '',
    '存在しないファイルを rubrics に入れてはならない。必ず実在を確認すること。',
  ].join('\n'),
  { label: 'discover', phase: 'Discover', schema: DISCOVER_SCHEMA }
)

const files = discovered.files
const rubrics = discovered.rubrics || []
const ssotTableFile = discovered.ssotTableFile || ''
const hasRefRule = !!discovered.hasReferenceDirectionRule

if (files.length === 0) {
  log('監査対象が 0 件のため終了する')
  return { file: null, files: 0, candidates: 0, confirmed: 0 }
}

log(
  `監査対象: ${files.length} ファイル / 規約: ${rubrics.length ? rubrics.join(', ') : 'なし'}` +
    `${ssotTableFile ? ` / SSOT 対応表: ${ssotTableFile}` : ' / SSOT 対応表なし'}` +
    `${hasRefRule ? '' : ' / 参照方向の規約なし（この観点はスキップ）'}`
)

// 規約が 1 つも無いリポジトリでは、値の矛盾（客観的に判定できる観点）だけに絞る。
const rubricNote = rubrics.length
  ? `判定の前に、このリポジトリの規約を Read せよ: ${rubrics.join(' / ')}`
  : 'このリポジトリには明文化されたドキュメント規約が見つからなかった。値の矛盾（客観的に判定できるもの）に絞って判定し、規約違反としての指摘は挙げないこと。'

// 2. Extract: fan-out。1ファイル=1エージェントで精読し、圧縮した事実集合に変換する。
//    フルテキストを後段に渡さず事実だけに圧縮することで Detect の "Lost in the middle" を緩和する。
phase('Extract')
const extractions = (
  await parallel(
    files.map((f) => () =>
      agent(
        [
          `次のドキュメントを精読し、構造化して抽出せよ: ${f}`,
          '',
          '- facts: 他ファイルと矛盾し得る具体値（ポート/バージョン/URL/パス/コマンド引数/件数など）。本文に明示された値のみ。',
          '- ssotOwned: このファイルが唯一の情報源として所有を主張している情報。',
          hasRefRule
            ? '- referencesUp: このファイルがドキュメント層（docs/ 等）にありながら、ツール・設定層（`.claude/` 配下等）を参照していたら true。ドキュメント層以外なら false。'
            : '- referencesUp: このリポジトリには参照方向の規約が無いため、常に false を返す。',
          '- suspectInlineDetail: README なのに手順・コマンド・設定値の詳細を本文へ直書きしている箇所（README 以外なら空配列）。',
        ].join('\n'),
        { label: `extract:${f}`, phase: 'Extract', schema: EXTRACT_SCHEMA }
      )
    )
  )
).filter(Boolean)

// 3. Detect: barrier 正当。横断比較は全抽出が揃って初めて成立するため、ここだけ集約する。
//    渡すのは圧縮済み事実集合のみ（フルテキストではない）。
phase('Detect')
const detect = await agent(
  [
    `次は ${extractions.length} 個のドキュメントから抽出した事実集合（JSON）。`,
    '',
    JSON.stringify(extractions),
    '',
    rubricNote,
    ssotTableFile ? `情報と唯一の情報源の対応表は ${ssotTableFile} にある。所有者の判定にはこれを使う。` : '',
    '',
    'その上で、ファイル間の指摘候補を列挙せよ:',
    '- contradiction: 同一トピックに複数ファイルが異なる値を記載している矛盾',
    ssotTableFile
      ? '- duplication: 同じ手順・設定値が複数ファイルに重複記述されている（対応表の所有者以外が本文に書いている場合）'
      : '- duplication: 同じ手順・設定値が複数ファイルに実質同内容で重複記述されている（どちらが正か判断できない状態になっているもの）',
    hasRefRule
      ? '- reference-direction: ドキュメント層から上位層への逆参照（referencesUp=true のファイル）'
      : '- reference-direction: このリポジトリには参照方向の規約が無いため、この種別の候補は挙げない',
    '',
    '確実な候補のみ挙げ、各候補に関与ファイルを files として明記すること。',
    '規約ファイルが見つからなかった観点について、一般論を根拠に「違反」として挙げてはならない。',
  ]
    .filter(Boolean)
    .join('\n'),
  { label: 'detect', phase: 'Detect', schema: DETECT_SCHEMA }
)
log(`指摘候補: ${detect.candidates.length} 件`)

// 4. Verify: fan-out。候補ごとに敵対的検証し、誤検出を落とす。
phase('Verify')
const verified = (
  await parallel(
    detect.candidates.map((c) => () =>
      agent(
        [
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
        ].join('\n'),
        { label: `verify:${c.kind}:${c.topic}`, phase: 'Verify', schema: VERDICT_SCHEMA }
      ).then((v) => ({ ...c, ...v }))
    )
  )
).filter(Boolean)

const confirmed = verified.filter((v) => v.isReal)
log(`確定指摘: ${confirmed.length} / 候補 ${detect.candidates.length}`)

// 5. Report: 確定指摘を重大度別の Markdown に整形し、tmp/<branch>/docs-report_<timestamp>.md へ追記する。
//    workflow スクリプト内では時刻取得が禁止（Date.now/new Date は throw）のため、
//    ブランチ名とタイムスタンプの算出・パス組み立てはエージェントに Bash で行わせる。
//    検出のみ。問題の自動修正はしない。
phase('Report')
const report = await agent(
  [
    '次の確定済み指摘を Markdown レポートに整形し、所定のファイルへ追記せよ。',
    '',
    '【書き出し先の決定】',
    '- Bash で現在ブランチ名を取得する: git rev-parse --abbrev-ref HEAD',
    '- Bash でタイムスタンプを取得する（時分秒）: date +%Y%m%d_%H%M%S',
    '- パスは tmp/<branch>/docs-report_<timestamp>.md とする。ブランチ名に / が含まれる場合は - に置換する。',
    '- mkdir -p tmp/<branch> でディレクトリを作成する。',
    '- 既存ファイルがあれば追記（先頭を上書きしない）、なければ新規作成する。',
    '- 書き込んだ相対パスを path として返す。',
    '',
    `- 監査対象ファイル数: ${files.length}`,
    `- 参照した規約: ${rubrics.length ? rubrics.join(', ') : 'なし'}`,
    `- 参照方向の観点: ${hasRefRule ? '有効' : '規約が無いためスキップ'}`,
    `- 指摘候補数: ${detect.candidates.length}`,
    `- 確定指摘数: ${confirmed.length}`,
    '',
    '確定指摘（JSON）:',
    JSON.stringify(confirmed),
    '',
    '【レポート本文の要件】',
    '- 追記する塊の先頭に「## 監査 <timestamp>（branch: <branch>）」の見出しを付け、いつの結果か分かるようにする。',
    '- その直下に「対象 N ファイル / 参照した規約 / スキップした観点」を 1 行で記す（何を見て何を見ていないかを明示する）。',
    '- severity を high → medium → low の順にセクション分けする。',
    '- 各指摘は「対象ファイル / 種別(kind) / 内容(detail) / 根拠(reason)」を含める。',
    '- 確定指摘が 0 件なら「指摘なし」と明記する。',
    '- ファイル新規作成時のみ、先頭に「# ドキュメント整合性 監査レポート」の H1 を置く（追記時は付けない）。',
    '- 末尾に「リンク切れ・markdown 規約などの機械チェックは Lint の担当。本監査は横断的な意味の整合のみを扱う」と注記する。',
    '- markdown 規約（見出し前後の空行・コードブロックの言語指定など）に従う。',
    '',
    '【禁止】',
    '- ドキュメントの修正は行わない。レポート出力のみに留める。',
    '- 監査対象ファイルへの Write / Edit をしない。',
  ].join('\n'),
  { label: 'report', phase: 'Report', schema: REPORT_SCHEMA }
)

return {
  file: report.path,
  files: files.length,
  rubrics,
  referenceDirectionChecked: hasRefRule,
  candidates: detect.candidates.length,
  confirmed: confirmed.length,
}

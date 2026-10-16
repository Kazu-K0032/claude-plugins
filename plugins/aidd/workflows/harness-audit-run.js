export const meta = {
  // リポジトリのファイルが、そのリポジトリの規約・方針・価値（ハーネス）に合うかと、
  // ファイル間の意味的な整合性を fan-out で網羅監査する workflow。
  // 機械チェック（リンク切れ・markdown 規約）は Lint の担当として重複させない。
  //
  // 対象の一覧は /aidd:harness-audit スキルが決め、args で渡す。
  // 実行前に件数と体数の見込みを示して利用者の確認を取るのはスキル側（workflow からは利用者に質問できない）。
  // 出力は tmp/<branch>/harness-audit_<timestamp>.md のみ。修正は行わない。
  name: 'harness-audit-run',
  description:
    'ファイルが規約・方針・価値に合うかと、ファイル間の値の矛盾・重複記述・参照方向違反を fan-out で監査し、各指摘を敵対的に検証して tmp/<branch>/harness-audit_<timestamp>.md に追記する。通常は /aidd:harness-audit から呼ぶ（args で { files: [...] } を渡す）',
  phases: [
    { title: 'Rubric', detail: '規約・方針・価値を探し、当てるファイル付きのチェックリストにする', model: 'opus' },
    { title: 'Inspect', detail: '1ファイル=1エージェントで、規約への違反の候補と事実を抽出', model: 'sonnet' },
    { title: 'Detect', detail: '全ファイルの事実集合を横断突合し矛盾・重複・参照方向違反の候補を生成', model: 'opus' },
    { title: 'Verify', detail: '違反の候補はファイルごと、横断の候補は1件ごとに敵対的に検証', model: 'opus' },
    { title: 'Report', detail: '確定指摘を重大度別に分け、推奨アクションを添えて tmp/<branch>/harness-audit_<timestamp>.md へ追記', model: 'sonnet' },
  ],
}

// --- 段ごとのモデルと effort ---
// 呼び出し元のモデルに任せると、費用が呼ぶ人のモデルで変わるため固定する。
// 規約の整理・横断の突合・検証は判断の質が結果を決めるため、opus / high で質を落とさない（V1）。
// 各ファイルの検査はファイル数ぶん走るため sonnet にし、規約への適合の判断が入るぶん effort を上げる。
// 誤検出は後段の検証で落とす。
const MODELS = {
  rubric: { model: 'opus', effort: 'high' },
  inspect: { model: 'sonnet', effort: 'high' },
  detect: { model: 'opus', effort: 'high' },
  verify: { model: 'opus', effort: 'high' },
  report: { model: 'sonnet', effort: 'medium' },
}

// 1 つの workflow のエージェント数は合計 1,000 が上限。
// Inspect と、ファイルごとの Verify が最大でファイル数ぶんずつ走り、横断の Verify と前後の段にも残りが要るため、
// 途中で上限に当たって結果が欠ける前に止める。
const MAX_FILES = 450

// --- スキーマ定義（agent の構造化出力を強制する） ---

// Rubric: 判定に使う規約と、そこから作ったチェックリスト
const RUBRIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rubrics', 'checklist', 'hasReferenceDirectionRule', 'ssotTableFile'],
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
        required: ['id', 'rule', 'appliesTo', 'source', 'basis'],
        properties: {
          id: { type: 'string', description: '項目の識別子（規約は R1, R2…、価値は V1, V2…）' },
          rule: { type: 'string', description: 'ファイルの中身で確かめられる決まり（1〜2 文）' },
          appliesTo: {
            type: 'array',
            items: { type: 'string' },
            description: '当てるファイルの glob（*・**・? のみ。例: **/*.md, .claude/settings.json）',
          },
          source: { type: 'string', description: '出典のパスと見出し' },
          basis: { type: 'string', enum: ['rule', 'value'], description: '具体的な決まりなら rule、価値・原則なら value' },
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

// Inspect: 1ファイルから抽出した、規約への違反の候補と、他ファイルと衝突し得る事実集合
const INSPECT_SCHEMA = {
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

// Verify（ファイルごと）: 1ファイルの違反の候補をまとめて判定した結果
const FILE_VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ruleId', 'location', 'detail', 'isReal', 'severity', 'reason'],
        properties: {
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

// --- args の解釈 ---
// { files: [...] } で対象を受け取る。文字列化された JSON で渡されても読めるようにする。
let input = args
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch (e) {
    input = null
  }
}
const files = input && Array.isArray(input.files) ? input.files.filter((f) => typeof f === 'string' && f) : []

if (files.length === 0) {
  log('対象のファイルが渡されていないため終了する。/aidd:harness-audit から呼ぶ（args の files に対象のパスを渡す）')
  return { file: null, files: 0, confirmed: 0 }
}
if (files.length > MAX_FILES) {
  log(
    `対象が ${files.length} ファイルあり、1 回の上限 ${MAX_FILES} を超えるため実行せずに終了する` +
      '（エージェント数の上限 1,000 に途中で当たり、結果が欠けるため）。対象を分けて呼ぶ'
  )
  return { file: null, files: files.length, confirmed: 0 }
}

// --- 本体 ---

// 1. Rubric: 判定に使う規約を探し、各ファイルに渡せる大きさのチェックリストにする。
//    規約のパスはリポジトリごとに違うため、固定せず探索させる。
//    見つからなかった観点は後段で「規約なし」として扱い、指摘を捏造させない。
phase('Rubric')
const rubric = await agent(
  [
    'このリポジトリの規約・方針・価値（ハーネス）を探し、監査対象のファイルに当てるチェックリストを作れ。',
    '',
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
    '- ファイルの中身で確かめられる決まりだけを入れる。操作の手順・会話での振る舞いなど、ファイルを読んでも確かめられないものは入れない。',
    '- 具体的な決まりは basis=rule、価値・原則（抽象的な考え方）は basis=value にする。',
    '- value の rule には、価値の文を短く引用し、ファイルのどんな書き方・作りがそれに反するかを書く。',
    '- appliesTo には当てるファイルの glob を書く。使える記号は *・**・? だけ（{a,b} は使わず、要素を分ける）。',
    '  `.claude/rules/*.md` の frontmatter に `paths:` があれば、それを appliesTo に使う。',
    '- source には出典のパスと見出しを書く（例: `.claude/rules/tmp-output.md` の「作業用のファイルを作る場合」）。',
    '- 同じ決まりを重ねて入れない。1 項目は 1〜2 文にする。',
    '',
    '判定結果:',
    '- ssotTableFile: 情報→唯一の情報源の対応表を持つファイルのパス。無ければ空文字。',
    '- hasReferenceDirectionRule: 「ドキュメント階層の参照は一方向に固定する（逆流は違反）」旨の規約が実在すれば true。',
    '  そういう規約が無いリポジトリでは false にする（推測で true にしないこと）。',
    '',
    '存在しないファイルを rubrics に入れてはならない。規約ファイルに無い一般論を、チェックリストに入れてはならない。',
  ].join('\n'),
  { label: 'rubric', phase: 'Rubric', schema: RUBRIC_SCHEMA, ...MODELS.rubric }
)

const rubrics = rubric.rubrics || []
const checklist = rubric.checklist || []
const ssotTableFile = rubric.ssotTableFile || ''
const hasRefRule = !!rubric.hasReferenceDirectionRule
const itemsById = new Map(checklist.map((it) => [it.id, it]))
const itemsFor = (f) => checklist.filter((it) => applies(it, f))
const uncovered = files.filter((f) => itemsFor(f).length === 0)

log(
  `監査対象: ${files.length} ファイル / 規約: ${rubrics.length ? rubrics.join(', ') : 'なし'}` +
    ` / チェックリスト: ${checklist.length} 項目（価値 ${checklist.filter((it) => it.basis === 'value').length}）` +
    `${ssotTableFile ? ` / SSOT 対応表: ${ssotTableFile}` : ' / SSOT 対応表なし'}` +
    `${hasRefRule ? '' : ' / 参照方向の規約なし（この観点はスキップ）'}`
)
if (uncovered.length > 0) {
  // 当てる項目が無いファイルも、横断の突合のために事実は抽出する。規約への適合は見ていないことを伝える
  log(`当てはまる規約が無いファイル: ${uncovered.length} 件（規約への適合は見ず、横断の突合にだけ使う）`)
}

// 規約が 1 つも無いリポジトリでは、値の矛盾（客観的に判定できる観点）だけに絞る。
const rubricNote = rubrics.length
  ? `判定の前に、このリポジトリの規約を Read せよ: ${rubrics.join(' / ')}`
  : 'このリポジトリには明文化された規約が見つからなかった。値の矛盾（客観的に判定できるもの）に絞って判定し、規約違反としての指摘は挙げないこと。'

// 2. Inspect → Verify（ファイルごと）: pipeline。1ファイル=1エージェントで精読し、
//    違反の候補があれば、そのファイルの検査が終わりしだい 1 体でまとめて検証する。
//    事実はフルテキストではなく圧縮して後段に渡し、Detect の "Lost in the middle" を緩和する。
phase('Inspect')
const perFile = await pipeline(
  files,
  (f) => {
    const items = itemsFor(f)
    return agent(
      [
        `次のファイルを精読し、構造化して抽出せよ: ${f}`,
        '',
        items.length
          ? '- violations: 次のチェックリストの項目に反している疑いのある箇所。疑いが強ければ確証が無くても挙げてよい（後段で検証する）。項目に無い一般論では挙げない。'
          : '- violations: このファイルに当てはまる項目が無いため、空配列を返す。',
        ...(items.length ? [JSON.stringify(items)] : []),
        '- facts: 他ファイルと矛盾し得る具体値（ポート/バージョン/URL/パス/コマンド引数/件数など）。本文に明示された値のみ。コード・設定のファイルは、コメントと設定値から拾う。',
        '- ssotOwned: このファイルが唯一の情報源として所有を主張している情報（コード・設定のファイルは空配列）。',
        hasRefRule
          ? '- referencesUp: このファイルがドキュメント層（docs/ 等）にありながら、ツール・設定層（`.claude/` 配下等）を参照していたら true。ドキュメント層以外なら false。'
          : '- referencesUp: このリポジトリには参照方向の規約が無いため、常に false を返す。',
        '- suspectInlineDetail: README なのに手順・コマンド・設定値の詳細を本文へ直書きしている箇所（README 以外なら空配列）。',
      ].join('\n'),
      { label: `inspect:${f}`, phase: 'Inspect', schema: INSPECT_SCHEMA, ...MODELS.inspect }
    )
  },
  async (inspected, f) => {
    if (!inspected) return null
    const candidates = inspected.violations || []
    if (candidates.length === 0) return { inspected, verdicts: [] }
    const items = [...new Set(candidates.map((c) => c.ruleId))].map((id) => itemsById.get(id)).filter(Boolean)
    const result = await agent(
      [
        `次のファイルについて挙がった、規約への違反の候補を敵対的に検証せよ: ${f}`,
        '確証が持てなければ isReal=false を既定とする。候補ごとに 1 件の verdict を返す（ruleId・location・detail は候補のまま写す）。',
        '',
        '違反の候補（JSON）:',
        JSON.stringify(candidates),
        '',
        '候補が根拠にしているチェックリストの項目（JSON）:',
        JSON.stringify(items),
        '',
        '手順:',
        '1. 対象のファイルを Read する。',
        '2. 各項目の source（出典）を Read し、項目の要約ではなく原文で決まりを確かめる。',
        '3. 本当にその決まりに反しているかを判定する。',
        '',
        '誤検出として除外すべきもの:',
        '- その決まりが、このファイルには当てはまらないもの（対象外の種類・場所のファイル）',
        '- 規約・テンプレート自身が、例（NG 例・プレースホルダなど）として書いている箇所',
        '- 出典に例外として書かれているもの',
        '- 出典の原文に無い根拠による指摘（「一般にこうすべき」だけを根拠にしたもの）',
        '- 価値（basis=value）を根拠にした候補で、価値の文と箇所の食い違いを具体的に説明できないもの',
        '',
        'severity は影響度（high=実害/誤誘導, medium=保守性低下, low=軽微）で付けること。',
        'reason には、ファイルのどの記述が、出典のどの文に反するかを具体的に書くこと。',
      ].join('\n'),
      { label: `verify:rules:${f}`, phase: 'Verify', schema: FILE_VERDICT_SCHEMA, ...MODELS.verify }
    )
    const verdicts = ((result && result.verdicts) || []).map((v) => {
      const item = itemsById.get(v.ruleId)
      return {
        ...v,
        kind: item && item.basis === 'value' ? 'value' : 'rule',
        files: [f],
        topic: item ? item.rule : v.ruleId,
        source: item ? item.source : '',
      }
    })
    return { inspected, verdicts }
  }
)

const done = perFile.filter(Boolean)
const inspections = done.map((r) => r.inspected)
const ruleVerdicts = done.flatMap((r) => r.verdicts)
const ruleCandidates = inspections.reduce((n, x) => n + (x.violations || []).length, 0)
if (inspections.length < files.length) {
  log(`検査できなかったファイル: ${files.length - inspections.length} 件（エージェントの失敗・スキップ）`)
}
log(`規約への違反の候補: ${ruleCandidates} 件 / 確定 ${ruleVerdicts.filter((v) => v.isReal).length} 件`)

// 3. Detect: barrier 正当。横断比較は全抽出が揃って初めて成立するため、ここだけ集約する。
//    渡すのは圧縮済み事実集合のみ（フルテキスト・違反の候補は渡さない）。
phase('Detect')
const factSets = inspections.map((x) => ({
  file: x.file,
  facts: x.facts,
  ssotOwned: x.ssotOwned,
  referencesUp: x.referencesUp,
  suspectInlineDetail: x.suspectInlineDetail,
}))
const detect = await agent(
  [
    `次は ${factSets.length} 個のファイルから抽出した事実集合（JSON）。`,
    '',
    JSON.stringify(factSets),
    '',
    rubricNote,
    ssotTableFile ? `情報と唯一の情報源の対応表は ${ssotTableFile} にある。所有者の判定にはこれを使う。` : '',
    '',
    'その上で、ファイル間の指摘候補を列挙せよ:',
    '- contradiction: 同一トピックに複数ファイルが異なる値を記載している矛盾。コードのコメントや設定値と、ドキュメントの記述の食い違いも含める',
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
  { label: 'detect', phase: 'Detect', schema: DETECT_SCHEMA, ...MODELS.detect }
)
log(`横断の指摘候補: ${detect.candidates.length} 件`)

// 4. Verify（横断）: fan-out。候補ごとに敵対的検証し、誤検出を落とす。
phase('Verify')
const crossVerdicts = (
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
        { label: `verify:${c.kind}:${c.topic}`, phase: 'Verify', schema: VERDICT_SCHEMA, ...MODELS.verify }
      ).then((v) => ({ ...c, ...v }))
    )
  )
).filter(Boolean)

const confirmed = [...ruleVerdicts, ...crossVerdicts].filter((v) => v.isReal)
const candidateCount = ruleCandidates + detect.candidates.length
log(`確定指摘: ${confirmed.length} / 候補 ${candidateCount}`)

// 5. Report: 確定指摘を重大度別に分け、直す順の推奨アクションを添えた Markdown に整形し、tmp/<branch>/harness-audit_<timestamp>.md へ追記する。
//    実行ごとの塊の構成は docs-sync・pr-review のレポートとそろえる（冒頭の文・high・medium・low・推奨アクション）。
//    workflow スクリプト内では時刻取得が禁止（Date.now/new Date は throw）のため、
//    ブランチ名とタイムスタンプの算出・パス組み立てはエージェントに Bash で行わせる。
//    ブランチ名の / を - に置換する規約は aidd の README.md の「ブランチ名の / は - に置き換える」。
//    検出のみ。問題の自動修正はしない。
phase('Report')
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
    `- 参照した規約: ${rubrics.length ? rubrics.join(', ') : 'なし'}`,
    `- チェックリストの項目数: ${checklist.length}`,
    `- 当てはまる規約が無かったファイル数: ${uncovered.length}`,
    `- 参照方向の観点: ${hasRefRule ? '有効' : '規約が無いためスキップ'}`,
    `- 指摘候補数: ${candidateCount}`,
    `- 確定指摘数: ${confirmed.length}`,
    '',
    '確定指摘（JSON）。kind は rule=規約違反、value=価値に反する、contradiction=値の矛盾、duplication=重複記述、reference-direction=参照方向違反:',
    JSON.stringify(confirmed),
    '',
    '【レポート本文の要件】',
    '- ファイル新規作成時のみ、先頭に「# harness-audit 実行結果」の H1 を置く（追記時は付けない）。',
    '- 追記する塊の先頭に「## 監査 <timestamp>（branch: <branch>）」の見出しを付け、いつの結果か分かるようにする。',
    `- その直下に、次の冒頭の文をそのまま書く: 「この監査は、harness-audit によって、規約・方針・価値への適合と、ファイル間の整合性（値の矛盾・重複記述・参照方向違反）の観点から、${files.length} 件のファイルに問題が無いかチェックし結果をレポートしたものです。」`,
    '- 冒頭の文の直後に、引用（>）の注記を書く（何を見て何を見ていないかを明示する）。',
    '  - 「参照した規約：…」（上の「参照した規約」から。無ければ「なし」）',
    '  - 「規約を当てなかったファイル：…件」（上の件数が 0 なら、この行は書かない）',
    '  - 「スキップした観点：…」（参照方向の観点が有効なら、この行は書かない）',
    '  - 「範囲：リンク切れ・markdown 規約などの機械チェックは Lint の担当。この監査は規約への適合と横断的な意味の整合を扱う」',
    '- 注記の後に、次の見出しをこの順で置く: 「### high」「### medium」「### low」「### 推奨アクション」。severity ごとに指摘を分ける。',
    '- 各指摘は「対象ファイル / 種別 / 内容(detail) / 根拠(reason)」を含める。種別は上の日本語名で書く。rule と value は、出典（source）も書く。',
    '- value（価値に反する）の指摘は解釈を含むため、根拠に価値の文の引用を入れ、種別で規約違反と見分けられるようにする。',
    '- 指摘が無い見出しには「なし」と 1 行書く。確定指摘が 0 件なら、4 つの見出しとも「なし」にする。',
    '- 推奨アクションは、直す順に番号を付けて 1 行ずつ書く。最大 5 件。high の指摘から先に並べ、対象ファイルと、何を直すかを書く。同じ原因の指摘は 1 項目にまとめる。',
    '- markdown 規約（見出し前後の空行・コードブロックの言語指定など）に従う。',
    '',
    '【禁止】',
    '- ファイルの修正は行わない。レポート出力のみに留める。',
    '- 監査対象ファイルへの Write / Edit をしない。',
  ].join('\n'),
  { label: 'report', phase: 'Report', schema: REPORT_SCHEMA, ...MODELS.report }
)

return {
  file: report.path,
  files: files.length,
  rubrics,
  checklist: checklist.length,
  uncovered: uncovered.length,
  referenceDirectionChecked: hasRefRule,
  candidates: candidateCount,
  confirmed: confirmed.length,
}

export const meta = {
  // PR を観点別の専門サブエージェントで並列レビューし、指摘ごとに敵対的検証してからレポートを tmp へ出力する workflow。
  // 設計は Anthropic 公式の Parallelization パターンの sectioning 変種（タスクを固定の観点に分割し並列実行）に、
  // 指摘 1 件 = 1 エージェントの敵対的検証を重ねた構成。
  // Ref: https://www.anthropic.com/engineering/building-effective-agents
  //
  // PR へ直接コメント投稿はしない。出力は tmp/<branch>/pr-review_<timestamp>.md のみ。
  // 投稿するかどうか・何を投稿するかは、レポートを読んだ人が判断する。
  name: 'pr-review',
  description:
    'PR を観点別の専門エージェント（機能性・要件順守 / バグ・セキュリティ / テスト・静的解析 / ドキュメント整合 / レイアウト耐性 / 反映経路・環境差分）で並列レビューし、指摘ごとに敵対的検証してから tmp/<branch>/pr-review_<timestamp>.md へ出力する（PR へは投稿しない）。番号省略時は現在ブランチの PR。観点は差分のファイル種別で自動選択。args で { pr, dimensions: [...] } も指定可',
  phases: [
    { title: 'Context', detail: 'PR 本文・紐づく Issue・変更ファイル一覧・差分行数を取得' },
    { title: 'Review', detail: '適用観点ごとに専門エージェントが差分を独立レビュー' },
    { title: 'Verify', detail: '指摘 1 件 = 1 エージェントで敵対的に検証し誤検出を除去' },
    { title: 'Report', detail: 'tmp/<branch>/pr-review_<timestamp>.md へ整形保存' },
  ],
}

// --- スキーマ定義（agent の構造化出力を強制する） ---

// Context: レビューに必要な PR の全体像
const CONTEXT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pr', 'title', 'body', 'issueNumber', 'issueBody', 'files', 'totalChangedLines'],
  properties: {
    pr: { type: 'number', description: 'PR 番号' },
    title: { type: 'string' },
    body: { type: 'string', description: 'PR 本文の原文（要約しない）' },
    issueNumber: { type: 'number', description: '紐づく Issue 番号。無ければ 0' },
    issueBody: { type: 'string', description: '紐づく Issue の本文原文。無ければ空文字' },
    files: { type: 'array', items: { type: 'string' }, description: '変更ファイルのパス一覧' },
    totalChangedLines: { type: 'number', description: 'additions + deletions' },
  },
}

// Review: 1 観点のレビュー結果（指摘 + 良好な点）
const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings', 'goodPoints'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'line', 'description', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['Critical', 'Important', 'Suggestion'] },
          file: { type: 'string', description: 'リポジトリルートからの相対パス' },
          line: { type: 'string', description: '行番号または範囲（例: 23, 61-63）。特定できなければ "-"' },
          description: { type: 'string', description: '問題の説明' },
          fix: { type: 'string', description: '具体的な修正案' },
        },
      },
    },
    goodPoints: { type: 'array', items: { type: 'string' }, description: '具体的に良かった設計判断・コード（無ければ空配列）' },
  },
}

// Verify: 指摘候補が本物かの敵対的判定
const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isReal', 'severity', 'reason'],
  properties: {
    isReal: { type: 'boolean' },
    severity: { type: 'string', enum: ['Critical', 'Important', 'Suggestion'], description: '再判定後の重大度' },
    reason: { type: 'string', description: '判定の根拠。差分のどの箇所を確認したか具体的に' },
  },
}

// Report: 書き出し結果
const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['path'],
  properties: {
    path: { type: 'string', description: '書き込んだレポートファイルの相対パス' },
  },
}

// --- 観点定義 ---
// applies(files) が true の観点だけを起動する（JS で決定的に判定。プロンプト依存にしない）。
// チェック項目は言語・フレームワークを名指ししない。プロジェクト固有の規約は
// 各エージェントがリポジトリ内の規約ファイルを探して補う（buildReviewPrompt の「規約の探索」を参照）。

const isCodeFile = (f) =>
  /\.(php|jsx?|tsx?|mjs|cjs|py|rb|go|rs|java|kt|swift|cs|sh|bash|tf|tftpl)$/.test(f) ||
  f.startsWith('.githooks/')

// 画面に出る要素を触る差分（レイアウト耐性の対象）
const isFrontendFile = (f) =>
  /\.(css|scss|sass|less|vue|svelte|astro)$/.test(f) ||
  /\.(jsx|tsx)$/.test(f) ||
  /\.(html|erb|twig|hbs|ejs|pug)$/.test(f) ||
  /\/(templates?|views?|components?|assets|theme|themes)\//.test(f)

// 自動デプロイに乗らない・環境差分が出やすい差分（反映経路の対象）
const isDeliverySensitive = (f) =>
  /^(infra|terraform|deploy|ops|provisioning)\//.test(f) ||
  /^\.github\/workflows\//.test(f) ||
  /^(migrations?|db|seed|seeds|fixtures)\//.test(f) ||
  /(^|\/)(Dockerfile|docker-compose\.ya?ml|compose\.ya?ml|Procfile)$/.test(f) ||
  /\/(mu-plugins|plugins)\//.test(f)

const isTestFile = (f) =>
  /(^|\/)(tests?|spec|specs|__tests__|e2e)\//.test(f) || /\.(test|spec)\.[a-z]+$/.test(f)

const DIMENSIONS = [
  {
    key: 'code',
    label: '機能性・要件順守',
    applies: () => true,
    checklist: [
      '- Issue 本文の各タスクが PR 変更で実装されているか（チェックリスト照合。実装漏れ = 不足方向）',
      '- スコープ逸脱（過剰方向）: Issue・依頼に無い変更（ついで修正・無関係なリファクタ・頼まれていない設定値やデフォルト値の追記）が混ざっていないか。混入は原則 Important で挙げる',
      '- 責務分離: レイヤーの境界を越えた実装が混ざっていないか（表示層にドメインロジック、設定と実装の混在など）。プロジェクトの規約があればそれに照らす',
      '- ルーティング・URL とテンプレート/ハンドラの対応がアーキテクチャ文書に沿うか',
      '- 同じ情報を 2 か所に書いていないか（唯一の情報源の重複）',
      '- エッジケース・境界値（空配列・未設定の値・null・0 件）の処理',
      '- 既存機能のデグレード: 差分の削除行・置換行を確認し、意図せず消えた既存の挙動（リンク・クラス・フック・分岐）がないか',
    ],
  },
  {
    key: 'errors',
    label: '潜在的バグ・セキュリティ',
    applies: (files) => files.some(isCodeFile),
    checklist: [
      '- 出力エスケープ漏れ: ユーザー入力・DB 値をそのまま出力していないか。出力先（HTML 本文 / 属性 / URL / JS / SQL）に応じた処理を使い分けているか',
      '- 認証・認可の欠落: 権限チェック、CSRF 対策トークン、直接オブジェクト参照の検証',
      '- 型の取り違え: 戻り値が可変な API（連想配列 / null / false を返しうるもの）を型ガードせず使用していないか',
      '- クエリの効率と後片付け: ループ内クエリ（N+1）、件数無制限の取得、グローバル状態の復元漏れ',
      '- 国際化: 翻訳関数に変数を渡していないか（リテラルを渡す）',
      '- クライアント JS のロジックエラー（off-by-one、条件分岐漏れ、イベントリスナ解除漏れ、要素が重なるケースの考慮漏れ）',
      '- IaC: 機密値の平文混入、ステートフルなリソースの破壊的 replace',
      '- シェルスクリプト: エラー時に途中で止まらない（set -e 相当の欠落）、未検証の変数展開によるパス破壊、冪等性（再実行しても安全か）',
      '- スクリプト言語: 例外の握りつぶし（bare except 相当）、相対パス前提の崩れ、必須キー欠落時のフォールバック漏れ',
    ],
  },
  {
    key: 'tests',
    label: 'テスト・静的解析',
    applies: (files) => files.some(isCodeFile) || files.some(isTestFile),
    checklist: [
      '- 静的解析・Lint で落ちないか（プロジェクトが導入しているツールと設定レベルを確認して照らす）',
      '- テスト方針との整合: プロジェクトのテスト戦略文書があれば、テスト名の付け方・構造（AAA 等）・観点（正常/異常/境界）に沿うか',
      '- UI・クライアント JS の変更に対応するテストの追加・更新があるか。テスト基盤が既にあるのに追加が無ければ Important / Suggestion で挙げる',
      '- 未導入の層のテスト不在を一律 Critical にしない（プロジェクトが導入していない層は指摘の重みを下げる）',
      '- テストの環境非依存性: ハードコードされた絶対パス・ローカル固有の前提がテストに混入していないか（ローカル通過 ≠ CI 通過）',
    ],
  },
  {
    key: 'docs',
    label: 'ドキュメント・整合性',
    applies: () => true,
    checklist: [
      '- ドキュメントの重複記述・参照方向違反（下位が上位を参照する構造の崩れ）',
      '- プロジェクトの規約ファイル（`.claude/rules/` 等）と実装の整合',
      '- コメント・docstring と実装の乖離（引数・戻り値の説明が実体と合っているか）',
      '- 命名の実態一致: 変数・関数・定数名が値・用途・スコープと一致しているか、同一概念に異なる命名が混在していないか',
      '- コード・インフラ変更に追従すべきドキュメント（仕様 / アーキテクチャ / 手順書）の更新漏れ',
      '- コミット粒度・メッセージがプロジェクトの規約に沿うか',
    ],
  },
  {
    key: 'layout',
    label: 'レイアウト耐性・CSS',
    applies: (files) => files.some(isFrontendFile),
    checklist: [
      '- 最小保証幅（375px 相当）と中間ブレークポイントで要素が画面外へ出ないか。クラス・スタイルの組合せ（固定高・max-height と overflow の併用、中央寄せと溢れの同居等）から静的に推論する',
      '- モーダル・ドロワーは狭い画面でも閉じる操作に到達できるか。高さの基準がビューポート単位の場合、モバイルブラウザのツールバーで可視領域が縮む前提になっているか',
      '- 既存のユーティリティクラスと新規スタイルの二重適用・競合',
      '- CSS セレクタが対象の要素型を網羅しているか（特定の入力型だけを拾って他を取りこぼしていないか）',
      '- 判定基準は「操作できるか」に限る。色・余白・書体など見た目のみのズレは挙げない',
      '- プロジェクトのデザインシステム規約があれば、トークン利用・任意値の禁止・グリッドとの整合を確認する',
    ],
  },
  {
    key: 'delivery',
    label: '反映経路・環境差分',
    applies: (files) => files.some(isDeliverySensitive),
    checklist: [
      '- 変更パスが自動デプロイの対象か: CI/CD 設定のトリガーパスを読み、対象外のパスの変更に手動反映の手順が PR 本文・Issue に書かれているか。無ければ Important で挙げる',
      '- IaC の差分がある場合、どの環境へ適用が要るか明記されているか。テンプレートから生成される成果物は、アプリのデプロイでは反映されない点を見落としていないか',
      '- 自動反映されるファイルと手動適用が要るファイルが 1 つの PR に同居していないか。同居する場合、反映順序が書かれているか',
      '- 反映後の後処理の要否: ルーティング変更 → ルートキャッシュ再生成 / コード差し替え → バイトコードキャッシュ破棄 / コンテンツ変更 → 静的再生成 / CDN 層変更 → キャッシュ無効化',
      '- 環境差分: ハードコードされた絶対パス・localhost 前提・ローカル専用の値が検証環境／本番でも成り立つか。接続先や認証方式を変える差分は、CI の secrets・手順書の追従も要る',
    ],
  },
]

// 敵対的検証で照合させる規約の「探し方」。
// プロジェクトごとにファイル名が違うため、パスを固定せず観点ごとの探索キーワードを渡す。
const RUBRIC_HINTS = {
  code: 'アーキテクチャ・責務分離・唯一の情報源に関する規約（CLAUDE.md、docs/architecture/、.claude/rules/）',
  errors: '言語別のコーディング規約・セキュリティ規約（.claude/rules/、.github/instructions/、CONTRIBUTING）',
  tests: 'テスト戦略・テスト規約（docs/strategies/、.claude/rules/、テスト設定ファイル）',
  docs: 'ドキュメント規約・コミット規約（.claude/rules/、docs/strategies/、commitlint 設定）',
  layout: 'デザインシステム規約・レスポンシブの要件（.claude/rules/、docs/specs/）',
  delivery: 'CI/CD 設定と運用手順書（.github/workflows/、docs/runbook/、docs/architecture/）',
}

// --- args の解釈 ---
// 数値 / 数値を含む文字列 = PR 番号。オブジェクト = { pr, dimensions }。
const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key)
let argPr = null
let onlyDimensions = null
if (typeof args === 'number') {
  argPr = args
} else if (typeof args === 'string' && args.trim()) {
  const m = args.match(/\d+/)
  if (m) argPr = parseInt(m[0], 10)
  // トークン単位の完全一致（部分一致だと自然文中の裸の英単語「docs」等に誤爆する）
  const tokens = args.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  const dims = DIMENSION_KEYS.filter((k) => tokens.includes(k))
  if (dims.length > 0) onlyDimensions = dims
} else if (args && typeof args === 'object') {
  if (args.pr) argPr = Number(args.pr)
  if (Array.isArray(args.dimensions) && args.dimensions.length > 0) {
    const invalid = args.dimensions.filter((k) => !DIMENSION_KEYS.includes(k))
    if (invalid.length > 0) {
      throw new Error(
        `args.dimensions に未知のキーがあります: ${invalid.join(', ')}。有効なキー: ${DIMENSION_KEYS.join(', ')}`
      )
    }
    onlyDimensions = args.dimensions
  }
}

// --- 本体 ---

// 1. Context: PR の全体像を取得する
phase('Context')
const ctx = await agent(
  [
    argPr
      ? `PR #${argPr} のレビューに必要なコンテキストを収集せよ。`
      : '現在のブランチに紐づく PR のレビューに必要なコンテキストを収集せよ。PR 番号は `gh pr view --json number` で解決する。',
    '',
    '手順（すべて Bash の gh CLI で取得する）:',
    '1. `gh pr view <番号> --json number,title,body,additions,deletions` で PR 情報を取得する。',
    '2. 紐づく Issue 番号を特定する。手掛かりは PR 本文の「#<数字>」参照（Closes #N 等）とブランチ名先頭の数字。見つかれば `gh issue view <番号>` で本文を取得する。無ければ issueNumber は 0、issueBody は空文字。',
    '3. `gh pr diff <番号> --name-only` で変更ファイル一覧を取得し、出力行をそのまま files に入れる。',
    '4. totalChangedLines は additions + deletions の合計。',
    '',
    'body・issueBody は原文のまま返す（要約・省略をしない）。',
  ].join('\n'),
  { label: 'context', phase: 'Context', schema: CONTEXT_SCHEMA }
)
const pr = ctx.pr

// 観点の選択: args の明示指定が最優先。無ければ差分のファイル種別で自動判定する
const active = DIMENSIONS.filter((d) =>
  onlyDimensions ? onlyDimensions.includes(d.key) : d.applies(ctx.files)
)
if (active.length === 0) {
  // 起動観点 0 件のまま Review/Report へ進むと「指摘 0 件 → Approve」のレポートを出しかねないため、ここで止める。
  throw new Error(
    `起動する観点が 0 件です（onlyDimensions=${JSON.stringify(onlyDimensions)}）。DIMENSION_KEYS のいずれかが対象差分に該当する必要があります。`
  )
}
const skipped = DIMENSIONS.filter((d) => !active.includes(d)).map((d) => d.key)

// 小規模 PR（差分 100 行未満）は 1 本の統合レビュアーへ縮退する。検証 fan-out は維持する。
const isSmall = ctx.totalChangedLines < 100
const reviewUnits = isSmall
  ? [
      {
        key: 'all',
        label: `統合（小規模 PR: ${active.map((d) => d.key).join('+')}）`,
        checklist: active.flatMap((d) => [`【観点: ${d.label}】`, ...d.checklist]),
      },
    ]
  : active

log(
  `PR #${pr}「${ctx.title}」変更 ${ctx.files.length} ファイル / ${ctx.totalChangedLines} 行。` +
    `観点: ${active.map((d) => d.key).join(', ')}${skipped.length ? `（対象差分なしのため省略: ${skipped.join(', ')}）` : ''}` +
    `${isSmall ? ' / 小規模のため統合レビュアーに縮退' : ''} / 出力は tmp のみ（PR へ投稿しない）`
)

// レビュー用プロンプトを組み立てる
const buildReviewPrompt = (u) =>
  [
    `PR #${pr} を「${u.label}」の観点で独立レビューせよ。`,
    '',
    `PR タイトル: ${ctx.title}`,
    ctx.issueNumber ? `紐づく Issue: #${ctx.issueNumber}` : '紐づく Issue: なし',
    '',
    'PR 本文:',
    ctx.body || '（本文なし）',
    '',
    ...(ctx.issueNumber ? ['Issue 本文:', ctx.issueBody, ''] : []),
    '変更ファイル一覧:',
    ctx.files.join('\n'),
    '',
    `手順: Bash で \`gh pr diff ${pr}\` を実行して差分を取得し、必要に応じてリポジトリ内の関連ファイルを Read して文脈を確かめる。レビュー対象はこの PR の差分（差分が周辺コードへ与える影響を含む）に限る。`,
    '',
    '【規約の探索】チェックの前に、このリポジトリの規約を Glob / Read で特定する。',
    `- 探す場所: ${RUBRIC_HINTS[u.key] || Object.values(RUBRIC_HINTS).join(' / ')}`,
    '- 見つかった規約に照らして判定する。見つからない観点は、その旨を踏まえて一般的なベストプラクティスで判定し、規約違反としては挙げない。',
    '',
    'チェック項目:',
    ...u.checklist,
    '',
    'ルール:',
    '- 各指摘に必ず file と line を付ける（差分から行番号を特定できなければ line は "-"）。',
    '- 推測に基づく評価をしない。実在しないファイル・規約を根拠にしない。',
    '- ロックファイル・ビルド成果物・フォーマットのみの差分は軽微な確認に留める。',
    '- 忖度や配慮による甘い評価をしない。一方で問題の捏造もしない。',
    '- 確実な指摘のみ挙げ、迷う場合は挙げない（後段で敵対的に検証する）。無ければ findings は空配列で返す。',
    '- goodPoints には具体的に良かった設計判断・コードを挙げる（無ければ空配列）。',
  ].join('\n')

// 検証用プロンプトを組み立てる
const buildVerifyPrompt = (u, fd) => {
  const hint = RUBRIC_HINTS[u.key] || Object.values(RUBRIC_HINTS).join(' / ')
  return [
    '次の PR レビュー指摘候補を敵対的に検証せよ。確証が持てなければ isReal=false を既定とする。',
    '',
    `対象 PR: #${pr} / レビュー観点: ${u.label}`,
    JSON.stringify(fd),
    '',
    '手順:',
    `1. Bash で \`gh pr diff ${pr}\` を取得し、指摘箇所が差分に実在するか・指摘どおりの内容かを確かめる。必要ならリポジトリ内のファイルを Read する。`,
    `2. 指摘内容に関係する規約を Glob / Read で探して照合する。探す場所: ${hint}`,
    '3. 指摘が本当に成立するか、severity（Critical=マージをブロックすべき / Important=マージ前に対処が望ましい / Suggestion=改善提案）が妥当かを再判定する。',
    '',
    '誤検出として除外すべきもの:',
    '- 差分に存在しない行・ファイルへの指摘（ハルシネーション）',
    '- この PR の差分が導入したものではない既存コード由来の問題（ただし差分が悪化させた場合は有効）',
    '- 規約・ドキュメントに実在しない根拠による指摘（規約ファイルが見つからないのに「規約違反」としているもの）',
    '- プロジェクト規約が要求していない、好みレベルのスタイル指摘',
    '',
    'reason には、差分・規約のどの箇所を確認してどう判断したかを具体的に書くこと。',
  ].join('\n')
}

// 2 + 3. pipeline: Review → Verify を観点単位で独立に流す。
//    観点 A の Verify 中に観点 B の Review を進められ、barrier より wall-clock が短い。
//    横断集約（重複統合）は Report エージェントが確定指摘に対して行うため、ここに barrier は要らない。
phase('Review')
const perUnit = await pipeline(
  reviewUnits,
  // stage1（Review）: 1 観点 = 1 エージェントで差分をレビューする
  (u) => agent(buildReviewPrompt(u), { label: `review:${u.key}`, phase: 'Review', schema: FINDINGS_SCHEMA }),
  // stage2（Verify）: 同一観点の指摘を 1 件ずつ敵対的に検証する。指摘ゼロなら何もしない
  async (reviewed, u) => {
    const findings = (reviewed && reviewed.findings) || []
    const goodPoints = (reviewed && reviewed.goodPoints) || []
    if (findings.length === 0) return { key: u.key, verified: [], goodPoints }
    const verified = (
      await parallel(
        findings.map((fd) => () =>
          agent(buildVerifyPrompt(u, fd), {
            label: `verify:${u.key}:${fd.file}:${fd.line}`,
            phase: 'Verify',
            schema: VERDICT_SCHEMA,
          }).then((v) => ({ dimension: u.key, ...fd, ...v }))
        )
      )
    ).filter(Boolean)
    return { key: u.key, verified, goodPoints }
  }
)

const units = perUnit.filter(Boolean)
const allVerified = units.flatMap((u) => u.verified)
const confirmed = allVerified.filter((v) => v.isReal)
const goodPoints = [...new Set(units.flatMap((u) => u.goodPoints))]
log(`確定指摘: ${confirmed.length} / 候補 ${allVerified.length}（検証で棄却 ${allVerified.length - confirmed.length}）`)

// 4. Report: テンプレートへ整形して tmp へ保存する。PR へは投稿しない。
//    workflow スクリプト内では時刻取得が禁止（Date.now/new Date は throw）のため、
//    ブランチ名とタイムスタンプの算出・パス組み立てはエージェントに Bash で行わせる。
phase('Report')
const report = await agent(
  [
    `PR #${pr}「${ctx.title}」の検証済みレビュー結果を Markdown に整形し、tmp へ保存せよ。`,
    '**PR へのコメント投稿はしない。** 投稿の可否は、このレポートを読んだ人が判断する。',
    '',
    '【書き出し先の決定】',
    '- Bash で現在ブランチ名を取得する: git rev-parse --abbrev-ref HEAD',
    '- Bash でタイムスタンプを取得する（時分秒）: date +%Y%m%d_%H%M%S',
    '- パスは tmp/<branch>/pr-review_<timestamp>.md とする。ブランチ名に / が含まれる場合は - に置換する。mkdir -p tmp/<branch> でディレクトリを作成する。',
    '',
    '【入力データ】',
    `- 起動した観点: ${active.map((d) => `${d.key}（${d.label}）`).join(', ')}`,
    skipped.length ? `- 対象差分なしのため省略した観点: ${skipped.join(', ')}` : '- 省略した観点: なし',
    `- 小規模 PR のため統合レビュアーへ縮退: ${isSmall ? 'あり' : 'なし'}`,
    `- 指摘候補 ${allVerified.length} 件 → 敵対的検証で確定 ${confirmed.length} 件`,
    '',
    '確定指摘（JSON。severity は検証後の値を使う）:',
    JSON.stringify(confirmed),
    '',
    '良好な点（JSON）:',
    JSON.stringify(goodPoints),
    '',
    '【本文の構成】次のテンプレートに従う:',
    '```markdown',
    '## コードレビュー結果',
    '',
    '### 🧠 観点別レビューの分析要約',
    '',
    '[起動した観点と件数、省略した観点、検証で棄却された候補数、レビュー全体の所見]',
    '',
    '### ❌ Critical',
    '',
    '- `path/to/file.php:42` — [問題の説明と修正案]',
    '',
    '### ⚠️ Important',
    '',
    '### 💡 Suggestion',
    '',
    '### ✅ 良好な点',
    '',
    '### 📋 総合評価',
    '',
    '- **タスク達成度**: [達成状況]',
    '- **コード品質**: [評価]',
    '- **保守性**: [評価]',
    '',
    '### 🎯 判定',
    '',
    '**Approve / Comment / Request Changes のいずれか**',
    '',
    '[判定理由と次のステップ]',
    '```',
    '',
    '【整形ルール】',
    '- 指摘がない重大度のセクションも「なし」と 1 行で記し、省略しない（見落としでないことを明示する）。',
    '- 各指摘には必ず `path:line` を添える（line が "-" の指摘はパスのみ）。',
    '- 同一 file:line に対する実質同内容の指摘は 1 件へ統合する（観点が違っても内容が同じなら重複）。',
    '- 判定の目安: Critical あり → Request Changes / Important のみ → Comment / 指摘なし・Suggestion のみ → Approve。機械的に決めず総合判断でよいが、理由を明記する。',
    '',
    '【禁止】',
    '- `gh pr comment` / `gh pr review` を実行しない。このワークフローは出力を tmp に留める。',
    '- 保存したファイルのパスを path として返す。',
  ].join('\n'),
  { label: 'report', phase: 'Report', schema: REPORT_SCHEMA }
)

return {
  file: report.path,
  pr,
  dimensions: active.map((d) => d.key),
  small: isSmall,
  candidates: allVerified.length,
  confirmed: confirmed.length,
}

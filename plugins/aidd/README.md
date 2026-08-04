# aidd

AIDD（AI-Driven Development）と DocDD（Doc Driven Development）の定型作業を Skill 化したツールキット。

「仕様・判断・手順をドキュメントに残しながら進める」開発スタイルを前提にしている。ADR で判断を記録し、ナレッジで共有知を残し、PR 前にドキュメントとの食い違いを潰す、という流れを Skill として固めたもの。

## 収録スキル

| スキル | 用途 |
| --- | --- |
| `/aidd:adr` | ADR（アーキテクチャ決定記録）の新規作成・ステータス更新 |
| `/aidd:knowledge` | 1 ツール 1 ファイルの入門ドキュメントを作成（公式情報を調査して執筆） |
| `/aidd:pr-create` | PR 本文とレビュワー向け検証コメントの下書きを生成 |
| `/aidd:pr-check` | Issue のタスクが PR で実装されているかを照合 |
| `/aidd:skill-check` | Skill の frontmatter・スコープ・参照切れを点検 |
| `/aidd:commit` | ステージ済み差分から Conventional Commits 形式のメッセージを提案 |
| `/aidd:research` | 技術調査を `aidd-research` に委譲し、引用付きで回答 |
| `/aidd:agent-promote` | 繰り返している作業を永続カスタムエージェントへ昇格 |
| `/aidd:ai-report` | セッションログを分析し、利用状況・トークンコスト・改善点をレポート化 |
| `/aidd:docs-sync` | ブランチ差分にドキュメントが追従しているかを点検 |

同梱エージェント。

| エージェント | 用途 |
| --- | --- |
| `aidd-research` | 公式ドキュメントを調査し、引用（英語は和訳付き）で回答する |

同梱 Workflow（複数エージェントを決まった順序で動かすスクリプト）。

| Workflow | 用途 |
| --- | --- |
| `pr-review` | PR を 6 観点で並列レビューし、指摘ごとに敵対的検証してレポートを出力 |
| `docs-consistency-audit` | ドキュメント間の値の矛盾・重複記述・参照方向違反を横断監査 |

これで移植対象の 8 スキルが揃った。WordPress / AWS 固有の Skill（`debug-log`・`staatic-sync` 等）は案件リポジトリのローカルに残し、このプラグインには含めない。

## ディレクトリ構成

```text
aidd/
├── .claude-plugin/
│   └── plugin.json      # プラグインのマニフェスト
├── skills/              # Skill 本体（1 ディレクトリ 1 Skill）
│   ├── adr/
│   │   ├── SKILL.md
│   │   └── _template.md
│   └── ...              # 各 Skill が補助ファイル・scripts/ を持つ
├── agents/              # サブエージェント定義
│   └── aidd-research.md
├── workflows/           # 複数エージェントを束ねるスクリプト
│   ├── pr-review.js
│   └── docs-consistency-audit.js
└── references/          # Skill が実行時に読む共通規約
    ├── markdown.md      # markdownlint 準拠の書式
    ├── document.md      # SSOT・文体・構造
    ├── plain-language.md # 平易化の技法
    ├── response-style.md # 回答スタイルの適用範囲
    └── ai-research.md   # AI 出力を引用として扱わないための規約
```

## references/ とは何か

Claude Code の `.claude/rules/`（常時適用ルール）は**プラグインでは配布できない**。プラグインが持てるのは Skill・エージェント・フック・MCP サーバー等で、`rules` はその一覧に無い。

そのため、複数の Skill が共有する規約は `references/` に置き、各 `SKILL.md` の本文から明示的に読ませている。

```markdown
Markdown の書式は `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` を Read し、その規約に従う。
```

`${CLAUDE_PLUGIN_ROOT}` はプラグインの実体パスに展開される。Skill 本文で展開されるため、インストール先が変わっても解決できる。

### `.claude/rules/` との違い

| | 読み込みタイミング | 役割 |
| --- | --- | --- |
| `.claude/rules/*.md` | セッション開始時・対象ファイルを開いた時に**自動** | 常時適用の制約 |
| `references/*.md` | Skill 実行時に `SKILL.md` の指示で**明示的に** | その Skill の判断基準 |

自動適用の機能は移せないため、`references/` は「Skill が使う判断基準」に限定している。

### 保守上の注意

`references/` の内容は、元になったプロジェクトの `.claude/rules/` と重複する。**汎用ルールはこのプラグイン側を正**とし、規約を直すときは両方を直す。

## 設計上の決めごと

### 出力先パスは固定しない

`docs/adr/` のようなパスはプロジェクトごとに違う。プラグインの設定機構（`userConfig`）は**プロジェクトの `settings.json` を読まない**仕様のため、設定値では切り替えられない。

代わりに各 Skill が「規約のパスを見る → 無ければ候補を探す → それでも無ければユーザーに聞く」の順で解決する。勝手にディレクトリを作ることはしない。

### `allowed-tools` に `Write` を入れない

出力先が可変でパスパターンを固定できないため、ファイル書き込みは白紙委任せず通常の許可プロンプトを通す。ADR のように「ユーザー承認が前提」の Skill では、この方が意図に合う。

### 外部へ直接書き込まない

レビュー結果・レポートは必ず `tmp/<ブランチ名>/` へ出力し、**PR へのコメント投稿はしない**。`pr-review` は移植元では `gh pr comment` で投稿していたが、このプラグインでは投稿処理を削除した。

理由は 2 つ。プラグインは複数プロジェクトへ配られるため、どのリポジトリでも同じ判断で外部へ書き込むのは危険。もう 1 つは、レビュー結果は人が読んで採否を決めるべきもので、投稿は判断のあとに来る操作だから。

# aidd

AIDD（AI-Driven Development）と DocDD（Doc Driven Development）の定型作業を Skill 化したツールキット。

「仕様・判断・手順をドキュメントに残しながら進める」開発スタイルを前提にしている。ADR で判断を記録し、PR 前にドキュメントとの食い違いを潰し、コミット・PR の下書きまでを定型化する、という流れを Skill として固めたもの。

## 収録スキル

| スキル | 用途 |
| --- | --- |
| `/aidd:adr` | ADR（アーキテクチャ決定記録）の新規作成・ステータス更新 |
| `/aidd:pr-create` | PR 本文とレビュワー向け検証コメントの下書きを生成 |
| `/aidd:issue-pr-sync` | 既存の Issue / PR を、現在の差分とレビュー対応に合わせて更新 |
| `/aidd:commit` | ステージ済み差分から Conventional Commits 形式のメッセージを提案 |
| `/aidd:research` | 技術調査を `aidd:research` エージェントに委譲し、引用付きで回答 |
| `/aidd:ai-report` | セッションログを分析し、利用状況・トークンコスト・改善点をレポート化 |
| `/aidd:docs-sync` | ブランチ差分にドキュメントが追従しているかを点検 |
| `/aidd:init-repo` | ハーネス設定（`.claude/`）・GitHub の定型ファイル・ドキュメントの骨組みをリポジトリへ導入 |

同梱エージェント。

| エージェント | 用途 |
| --- | --- |
| `research` | 公式ドキュメントを調査し、引用（英語は和訳付き）で回答する |

同梱 Workflow（複数エージェントを決まった順序で動かすスクリプト）。

| Workflow | 用途 |
| --- | --- |
| `pr-review` | PR を 6 観点で並列レビューし、指摘ごとに敵対的検証してレポートを出力 |
| `docs-consistency-audit` | ドキュメント間の値の矛盾・重複記述・参照方向違反を横断監査 |

収録は上記 8 スキル。WordPress / AWS 固有の Skillは案件リポジトリのローカルに残し、このプラグインには含めない。

## ディレクトリ構成

```text
aidd/
├── .claude-plugin/
│   └── plugin.json      # プラグインのマニフェスト
├── skills/              # Skill 本体（1 ディレクトリ 1 Skill）
│   ├── adr/
│   │   ├── SKILL.md
│   │   └── _template.md
│   ├── init-repo/
│   │   ├── SKILL.md
│   │   ├── scripts/     # テンプレートを導入先へコピーするインストーラ
│   │   └── files/       # 導入先リポジトリのルートへ置く一式（.claude/ ・.github/ 等）
│   └── ...              # 各 Skill が補助ファイル・scripts/ を持つ
├── agents/              # サブエージェント定義
│   └── research.md
├── workflows/           # 複数エージェントを束ねるスクリプト
│   ├── pr-review.js
│   └── docs-consistency-audit.js
└── references/          # Skill が実行時に読む共通規約
    ├── markdown.md      # markdownlint 準拠の書式
    ├── document.md      # SSOT・文体・構造
    ├── plain-language.md # 平易化の技法
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

常時適用したい規約（`.claude/rules/*.md`）は、`init-repo` Skill が導入先リポジトリへコピーする形で配る。実体は `skills/init-repo/files/.claude/rules/` にあり、コピーされて初めて自動適用の対象になる。

### 保守上の注意

`references/` の内容は、元になったプロジェクトの `.claude/rules/` と重複する。**汎用ルールはこのプラグイン側を正**とし、規約を直すときは両方を直す。

## 設計上の決めごと

### 出力先パスは固定しない

`docs/adr/` のようなパスはプロジェクトごとに違う。プラグインの設定機構（`userConfig`）は**プロジェクトの `settings.json` を読まない**仕様のため、設定値では切り替えられない。

代わりに各 Skill が「規約のパスを見る → 無ければ候補を探す → それでも無ければユーザーに聞く」の順で解決する。勝手にディレクトリを作ることはしない。

### `allowed-tools` は出力先が固定のものだけ許可する

`tmp/<ブランチ名>/` のようにパスパターンを固定できる書き込みは `allowed-tools` に載せる。レポート・下書きの出力はここに該当する。

出力先がプロジェクトごとに変わる Skill（`adr` など）は書き込み許可を載せず、通常の許可プロンプトを通す。パターンを固定できない書き込みを白紙委任しないため。「ユーザー承認が前提」の Skill では、この方が意図に合う。

書き込みの許可は `Edit(<パス>)` で書く。Claude Code はファイル権限を `Edit()` と `Read()` の規則だけで判定し、`Write()` / `NotebookEdit()` / `Glob()` のパス規則は受け付けるが参照しない（起動時に警告が出る）。Ref: [Configure permissions](https://code.claude.com/docs/ja/permissions)

### 同梱スクリプトの実行は `allowed-tools` に載せない

`${CLAUDE_PLUGIN_ROOT}` が frontmatter の `allowed-tools` で展開されるかは公式に記載が無い。プラグインの実体パスはインストール先で変わるため、当てにせず通常の許可プロンプトを通す。

`ai-report`・`commit`・`docs-sync` の 3 スキルが同梱スクリプトを持つが、いずれもスクリプト実行の `Bash` パターンは載せていない。

### エージェント名にプラグイン名を付けない

プラグイン由来のエージェントには、Claude Code が自動で `<プラグイン名>:` を前置する。frontmatter の `name` に自分で付けると `aidd:aidd-research` のように二重になる。

逆に Skill 側から起動するときは、接頭辞付きの識別子（`subagent_type: aidd:research`）で指定する。接頭辞なしの裸の名前は、同名のエージェントを持つ他プラグインと衝突しうるため。

### 外部へ直接書き込まない

レビュー結果・レポートは必ず `tmp/<ブランチ名>/` へ出力し、**PR へのコメント投稿はしない**。`pr-review` は移植元では `gh pr comment` で投稿していたが、このプラグインでは投稿処理を削除した。

理由は 2 つ。プラグインは複数プロジェクトへ配られるため、どのリポジトリでも同じ判断で外部へ書き込むのは危険。もう 1 つは、レビュー結果は人が読んで採否を決めるべきもので、投稿は判断のあとに来る操作だから。

唯一の例外が `issue-pr-sync` による Issue / PR **本文**の更新。「既存の記述を実態に合わせる」という目的上、下書きを出しても人が手で貼り直すだけになり、スキルの意味が消えるため。代わりに 3 つの歯止めを置いている。

- 反映前に必ず承認を取る
- サイドバー（ラベル・担当者等）は直接変更せず、適用コマンドの提示に留める
- `gh` の書き込み系サブコマンドは `allowed-tools` に載せず、通常の許可プロンプトを通す

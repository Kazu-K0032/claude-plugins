# aidd

AIDD（AI-Driven Development）と DocDD（Doc Driven Development）の定型作業を Skill 化したツールキット。

「仕様・判断・手順をドキュメントに残しながら進める」開発スタイルを前提にしている。Issue に着手する前に記述を確かめ、ADR で判断を記録し、PR 前にドキュメントとの食い違いを潰し、コミット・PR の下書きまでを定型化する、という流れを Skill として固めたもの。

## 収録スキル

| スキル | 用途 |
| --- | --- |
| `/aidd:adr` | ADR（判断の記録）の作成・ステータス更新。小さな技術的判断も対象にし、重さ（極小・簡易・詳細）を選んで書き、一覧に 1 行足す。判断が決まると Claude から作るかを聞く |
| `/aidd:issue-start` | Issue の記述を確かめて作業用のブランチを作り、計画モードで要件を詰めてから実装する。Issue の更新・コミットメッセージ・PR の下書きまで行う（コミット・push は人が行う） |
| `/aidd:pr-create` | PR 本文とレビュワー向け検証コメントの下書きを生成 |
| `/aidd:issue-pr-sync` | Issue / PR の本文（PR 本文が空なら新規作成）・タイトル・サイドバーを、現在の差分とレビュー対応に合わせて更新 |
| `/aidd:commit` | ステージ済み差分と会話の経緯から Conventional Commits 形式のメッセージを提案（CI の失敗を直すコミットには失敗した実行の URL を添える） |
| `/aidd:research` | 技術調査を `aidd:research` エージェントに委譲し、引用付きで回答 |
| `/aidd:ai-report` | セッションログを分析し、利用状況・トークンコスト・改善点をレポート化 |
| `/aidd:docs-sync` | ブランチ差分にドキュメントが追従しているかを点検 |

同梱エージェント。

| エージェント | 用途 |
| --- | --- |
| `research` | 公式ドキュメントを調査し、引用（英語は和訳付き）で回答する |

同梱 Workflow（複数エージェントを決まった順序で動かすスクリプト）。

| Workflow | 用途 |
| --- | --- |
| `pr-review` | PR を 6 観点で並列レビューし、指摘ごとに敵対的検証してレポートを出力 |
| `docs-consistency-audit` | ドキュメント間の値の矛盾・重複記述・参照方向違反を横断監査 |

収録は上記 8 スキル。WordPress / AWS 固有の Skillは案件リポジトリのローカルに残し、このプラグインには含めない。リポジトリへ規約一式を導入する `init-repo` は [project](../project/README.md) プラグインへ移した（`/project:init-repo`）。

## ディレクトリ構成

```text
aidd/
├── .claude-plugin/
│   └── plugin.json      # プラグインのマニフェスト
├── skills/              # Skill 本体（1 ディレクトリ 1 Skill）
│   ├── adr/
│   │   ├── SKILL.md
│   │   ├── _template.md        # 詳細版の雛形
│   │   ├── _template-short.md  # 簡易版の雛形（本文 10 行未満の文章を目安）
│   │   └── _template-mini.md   # 極小の雛形（題と 1〜2 文）
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

常時適用したい規約（`.claude/rules/*.md`）は、[project](../project/README.md) プラグインの `/project:init-repo` などが導入先リポジトリへコピーする形で配る。コピーされて初めて自動適用の対象になる。

### 保守上の注意

`references/` の内容は、元になったプロジェクトの `.claude/rules/` と重複する。**汎用ルールはこのプラグイン側を正**とし、規約を直すときは両方を直す。

`references/markdown.md` は [project](../project/README.md) プラグインにも同じ内容のコピーがある（プラグインをまたいでファイルを参照できないため）。片方を直したときは、もう片方も直すかを検討する（このリポジトリの `.claude/rules/duplicated-files.md` が対象のファイルの組を管理する）。

## 設計上の決めごと

### 出力先パスは固定しない

`docs/adr/` のようなパスはプロジェクトごとに違う。プラグインの設定機構（`userConfig`）は**プロジェクトの `settings.json` を読まない**仕様のため、設定値では切り替えられない。

代わりに各 Skill が「規約のパスを見る → 無ければ候補を探す → それでも無ければユーザーに聞く」の順で解決する。推測した場所には置かない（[P3](../../docs/policies/p03-check-placement.md)）。

### `allowed-tools` は出力先が固定のものだけ許可する

`tmp/<ブランチ名>/` のようにパスパターンを固定できる書き込みは `allowed-tools` に載せる。レポート・下書きの出力はここに該当する。

出力先がプロジェクトごとに変わる Skill（`adr` など）は書き込み許可を載せず、通常の許可プロンプトを通す。パターンを固定できない書き込みを白紙委任しないため（[P1](../../docs/policies/p01-operation-boundary.md)）。「ユーザー承認が前提」の Skill では、この方が意図に合う。

書き込みの許可は `Edit(<パス>)` で書く。Claude Code はファイル権限を `Edit()` と `Read()` の規則だけで判定し、`Write()` / `NotebookEdit()` / `Glob()` のパス規則は受け付けるが参照しない（起動時に警告が出る）。Ref: [Configure permissions](https://code.claude.com/docs/ja/permissions)

### 同梱スクリプトの実行は `allowed-tools` に載せない

`${CLAUDE_PLUGIN_ROOT}` が frontmatter の `allowed-tools` で展開されるかは公式に記載が無い。プラグインの実体パスはインストール先で変わるため、当てにせず通常の許可プロンプトを通す（[P1](../../docs/policies/p01-operation-boundary.md)）。

`ai-report`・`commit`・`docs-sync` の 3 スキルが同梱スクリプトを持つが、いずれもスクリプト実行の `Bash` パターンは載せていない。

### エージェント名にプラグイン名を付けない

プラグイン由来のエージェントには、Claude Code が自動で `<プラグイン名>:` を前置する。frontmatter の `name` に自分で付けると `aidd:aidd-research` のように二重になる。

逆に Skill 側から起動するときは、接頭辞付きの識別子（`subagent_type: aidd:research`）で指定する。接頭辞なしの裸の名前は、同名のエージェントを持つ他プラグインと衝突しうるため。

### GitHub への書き込み

レビュー結果・レポートは `tmp/<ブランチ名>/` へ出力し、PR へは投稿しない。`pr-review` は移植元では `gh pr comment` で投稿していたが、このプラグインでは投稿処理を削除した。指摘を人が読み、採否を決めてから投稿するため。

GitHub に書き込むのは次の 2 つ。どこまで Claude に任せるかの線引きは [P1](../../docs/policies/p01-operation-boundary.md)。

| スキル | 外部への書き込み |
| --- | --- |
| `issue-pr-sync` | Issue / PR の本文・タイトル・サイドバーを、実態に合わせて更新する |
| `issue-start` | Issue に紐づく作業用のブランチを作り、自分を担当者に足す。決めた仕様に合わせて Issue の本文とタスクを書き換える。着手を見送ったときは、ユーザーが選べば理由をコメントする |

`issue-start` が Issue の本文を書き換えるのは、計画モードで決めた仕様を、実装中・PR のレビュー中・後から Issue を読む人に届けるため。セッション内の報告や `tmp/`（`.gitignore` 済み）では、その人たちに届かない。

どちらも `gh` の書き込み系サブコマンドを `allowed-tools` に載せず、通常の許可プロンプトを通す。`gh issue develop` は一覧の表示（`--list`）とブランチの作成が同じ前方一致になるため、一覧の表示も含めて載せない。

`issue-pr-sync` の歯止め。

- 反映前に承認を取るのは、既存の記述を消す・意味を変える変更と、ほかの人に通知が届く変更だけ。追記・チェック・Issue に揃える変更は、承認なしで反映する。基準は `skills/issue-pr-sync/SKILL.md` の「承認を取る変更」
- 反映前の本文を `tmp/` に残し、報告で出力パスを示す。承認なしで反映した変更も戻せるようにするため
- Projects は変更しない。担当者・ラベルなど設定済みの値は、承認なしに外さない

`issue-start` の歯止め。

- 書き込むのは、ブランチの作成、自分を担当者に足すこと、Issue の本文の更新、着手を見送った理由のコメントだけ。ラベルと既存のコメントは変えず、既存の担当者も外さない
- Issue の本文を書き換える前に、今の本文を `tmp/` に書き出し、報告でパスを示す
- 確認で前提が崩れていると分かったときは、ブランチを作らずに止める。止めた理由のコメントは、ユーザーが選んだときだけ、同梱のテンプレート（`comment-template.md`）の形で投稿する。作業ツリーに未コミットの変更があるときは、ブランチを作る前に扱いを聞く
- 決めることは、計画モードで選択肢の質問にし、答えを待ってから実装する。実装は手元のファイルの編集まで。コミット・push はせず、直したファイルだけをステージに置き、コミットメッセージと PR の下書きを書く
- Issue に紐づいたブランチが既にあれば、新しく作らずにそのブランチへ移動する

### `issue-start` の要件の詰め方

決めることを依存関係の木にし、前提が決まった問いだけを回ごとにまとめて聞く。考え方は [mattpocock/skills の grilling](https://github.com/mattpocock/skills/blob/main/docs/productivity/grilling.md) を参考にした。別のプラグインのため呼び出さず、手順に書き込んでいる（[P5](../../docs/policies/p05-standalone-plugin.md)）。

### ブランチ名の `/` は `-` に置き換える

`tmp/<ブランチ名>/` に出力するときは、ブランチ名の `/` を `-` に置き換える（例：`issues/1-sample` → `tmp/issues-1-sample/`）。1 つのブランチの出力を 1 か所にまとめるため。`allowed-tools` の書き込み先も、1 階層だけに当たる `tmp/*/` で書く。

ワークフロー（`.js`）にはこの README を読ませにくい。そのため、各スキル・ワークフローにも同じ 1 文を書いている。規約を変えるときは、次の箇所もそろえて直す。

- `skills/` の `ai-report`・`docs-sync`・`issue-pr-sync`・`issue-start`・`pr-create` の `SKILL.md`
- `skills/ai-report/scripts/analyze.py` の `out_dir()`
- `workflows/` の `pr-review.js`・`docs-consistency-audit.js`

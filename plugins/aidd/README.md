# aidd

AIDD（AI-Driven Development）と DocDD（Doc Driven Development）の定型作業を Skill 化したツールキット。

「仕様・判断・手順をドキュメントに残しながら進める」開発スタイルを前提にしている。Issue に着手する前に記述を確かめ、ADR で判断を記録し、PR 前にドキュメントとの食い違いを潰し、コミット・PR の下書きまでを定型化する、という流れを Skill として固めたもの。統合ブランチへマージする前には、ハーネス監査で、リポジトリ全体が設計思想に合うかを確かめる。

## 収録スキル

| スキル | 用途 |
| --- | --- |
| `/aidd:adr` | ADR（判断の記録）の作成・ステータス更新。小さな技術的判断も対象にし、重さ（極小・簡易・詳細）を選んで書き、一覧に 1 行足す。判断が決まると Claude から作るかを聞く |
| `/aidd:issue-start` | Issue の記述を確かめて作業用のブランチを作り、計画モードで要件を詰めてから実装する。実装の後は `docs-sync` の手順で文書の追従を点検して直し、Issue の更新・コミットメッセージ・PR の下書きまで行う（コミット・push は人が行う） |
| `/aidd:pr-create` | PR 本文とレビュワー向け検証コメントの下書きを生成 |
| `/aidd:issue-pr-sync` | Issue / PR の本文（PR 本文が空なら新規作成）・タイトル・サイドバーを、現在の差分とレビュー対応に合わせて更新 |
| `/aidd:commit` | ステージ済み差分と会話の経緯から Conventional Commits 形式のメッセージを提案（CI の失敗を直すコミットには失敗した実行の URL を添える） |
| `/aidd:research` | 技術調査を `aidd:research` エージェントに委譲し、引用付きで回答 |
| `/aidd:ai-report` | セッションログを分析し、利用状況・トークンコスト・改善点をレポート化 |
| `/aidd:docs-sync` | ブランチ差分にドキュメントが追従しているかを点検 |
| `/aidd:harness-audit` | リポジトリが、このマーケットプレイスの設計思想と規約に合うかを、全体・差分・ディレクトリから範囲を選んで監査する。全体は init-repo からの作り直しの後や統合ブランチへのマージ前に、差分は PR の前に使う。実行前に、トークンを多く使うことと、件数・エージェント数の見込みを示して聞く |

同梱エージェント。

| エージェント | 用途 |
| --- | --- |
| `research` | 公式ドキュメントを調査し、引用（英語は和訳付き）で回答する |

同梱 Workflow（複数エージェントを決まった順序で動かすスクリプト）。

| Workflow | 用途 |
| --- | --- |
| `pr-review` | PR を 6 観点で並列レビューし、指摘ごとに敵対的検証して、直す箇所を high・medium・low に分け、推奨アクションを添えて出力 |
| `harness-audit-run` | `/aidd:harness-audit` の本体。設計思想・規約への適合、土台の仕組みの欠け、ファイル間の値の矛盾・重複記述・参照方向違反を監査する。対象の一覧・設計思想の要約・範囲（`scope`）・確認の印（`confirmed`）を `args` で受け取るため、スキルから呼ぶ。確認の印が無い呼び出しは走らない |

収録は上記 9 スキル。WordPress / AWS 固有の Skillは案件リポジトリのローカルに残し、このプラグインには含めない。リポジトリへ規約一式を導入する `init-repo` は [project](../project/README.md) プラグインへ移した（`/project:init-repo`）。

## 導入

スコープ（user / project / local）は問わない。`/project:init-repo` を使うリポジトリで project スコープに入れるときは、`init-repo` の後に入れる。先に入れると、登録が書き込まれた `.claude/settings.json` と、`init-repo` がコピーするものが衝突するため。

```bash
/plugin install aidd@kazu
```

`/project:init-repo` を使わないリポジトリでも動く。スキルの文面・出力は日本語で、日本語で運用する前提にしている。

### 要る道具

| 道具 | 使うスキル | 無いとき |
| --- | --- | --- |
| Bash ツール（Windows では Git Bash） | すべて（`date`・ヒアドキュメントなど） | 動かない。PowerShell だけの環境は対象外 |
| `gh`（GitHub CLI。ログイン済み） | `issue-start`・`issue-pr-sync`・`pr-create`・`pr-review`・`docs-sync`・`harness-audit` | Issue・PR を読めない |
| Node.js | `issue-start`・`issue-pr-sync`・`pr-create` | 本文の文字数を数えずに進む |
| Python 3.9 以上 | `ai-report` | 集計できない |
| bash 4 以上・perl・awk | `docs-sync`（`issue-start` の点検も） | 点検できない。macOS 標準の bash 3.2 では止まる |
| `sh` | `commit`（`issue-start` も） | シンボリックリンクを確かめられず止まる |

下書きとレポートは `tmp/` と `tmp.md` に書く。`.gitignore` に入れなくても動くが、入れるとコミットに混ざらない。`init-repo` は入れて配る。

同梱の Workflow（`pr-review` など）は、Claude Code の動的ワークフロー（dynamic workflows）で動く。切れていると `/` の候補に出ず、`/aidd:harness-audit` も監査の前に止まる。出ないときは、`/config` の「Dynamic workflows」の行をオンにする。Pro では初期設定でオフのため。ほかに止まる設定は、[harness-audit の errors.md](skills/harness-audit/errors.md) の「Workflow が使えないとき」にある。Ref: [Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)

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
│   └── harness-audit-run.js
├── scripts/             # 複数の Skill が使うスクリプト
│   └── body_length.js   # Issue・PR の本文の文字数を数える
└── references/          # Skill が実行時に読む共通規約
    ├── ai-check-lines.md # PR 本文の「AI を使った確認」の欄
    ├── base-branch.md   # マージ先（比べるブランチ）の決め方
    ├── pr-template.md   # PR テンプレートの探し方（pr-create・issue-pr-sync）
    ├── report-format.md # 点検レポート（docs-sync・pr-review・harness-audit）の構成
    ├── markdown.md      # markdownlint 準拠の書式
    ├── document.md      # SSOT・文体・構造
    ├── plain-language.md # 平易化の技法
    ├── short-body.md    # Issue・PR の本文の長さ
    ├── tmp-ignore.md    # tmp/・tmp.md の除外の確かめ方
    ├── ai-research.md   # AI 出力を引用として扱わないための規約
    └── harness-principles.md # 設計思想の要約（harness-audit の物差し）
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

`references/` や `scripts/` のファイルには、[project](../project/README.md) や [config](../config/README.md) に同じ内容のコピーがあるものがある（プラグインをまたいでファイルを参照できないため）。片方を直したときは、もう片方も直すかを検討する。組の一覧は、このリポジトリの [duplicated-files.md](../../.claude/rules/duplicated-files.md) が管理する。

## 設計上の決めごと

### 出力先パスは固定しない

`docs/adr/` のようなパスはプロジェクトごとに違う。プラグインの設定機構（`userConfig`）は**プロジェクトの `settings.json` を読まない**仕様のため、設定値では切り替えられない。

代わりに各 Skill が「規約のパスを見る → 無ければ候補を探す → それでも無ければユーザーに聞く」の順で解決する。推測した場所には置かない（[P3](../../docs/policies/p03-check-placement.md)）。

### `allowed-tools` は出力先が固定のものだけ許可する

`tmp/<ブランチ名>/` のようにパスパターンを固定できる書き込みは `allowed-tools` に載せる。レポート・下書きの出力はここに該当する。

出力先がプロジェクトごとに変わる Skill（`adr` など）は書き込み許可を載せず、通常の許可プロンプトを通す。パターンを固定できない書き込みを白紙委任しないため（[P1](../../docs/policies/p01-operation-boundary.md)）。「ユーザー承認が前提」の Skill では、この方が意図に合う。

書き込みの許可は `Edit(<パス>)` で書く。Claude Code はファイル権限を `Edit()` と `Read()` の規則だけで判定し、`Write()` / `NotebookEdit()` / `Glob()` のパス規則は受け付けるが参照しない（起動時に警告が出る）。Ref: [Configure permissions](https://code.claude.com/docs/ja/permissions)

読み取りのコマンドも、`git diff`・`git log` のように書き込みのオプションを持つものは前方一致で載せない。`git branch --show-current` のように完全一致で書く（[P1](../../docs/policies/p01-operation-boundary.md) の「確認なしで任せる操作」）。

### 同梱スクリプトの実行は `allowed-tools` に載せない

`${CLAUDE_PLUGIN_ROOT}` が frontmatter の `allowed-tools` で展開されるかは公式に記載が無い。プラグインの実体パスはインストール先で変わるため、当てにせず通常の許可プロンプトを通す（[P1](../../docs/policies/p01-operation-boundary.md)）。

`ai-report`・`commit`・`docs-sync` の 3 スキルが同梱スクリプトを持つが、いずれもスクリプト実行の `Bash` パターンは載せていない。`issue-start` が `docs-sync` の `run-checks.sh` を動かすときも同じ。`pr-create`・`issue-start`・`issue-pr-sync` が本文を数える `scripts/body_length.js` も載せていない。

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

`issue-start` が Issue の本文を書き換えるのは、計画モードで決めた仕様を、実装中・PR のレビュー中・後から Issue を読む人に届けるため。セッション内の報告や `tmp/`（コミットしない）では、その人たちに届かない。

どちらも `gh` の書き込み系サブコマンドを `allowed-tools` に載せず、通常の許可プロンプトを通す。`gh issue develop` は一覧の表示（`--list`）とブランチの作成が同じ前方一致になるため、一覧の表示も含めて載せない。

`issue-pr-sync`・`issue-start` の歯止め（承認を取る変更・反映前の本文を `tmp/` に残すこと・書き込む対象を限ることなど）は、各スキルの `SKILL.md` と参照ファイルが正典。PR 本文の「AI を使った確認」で、チェックを入れてよいのは、実行した本人の `/aidd:issue-pr-sync` の行と、同じ会話で Claude が実行して結果を見たコマンドの行だけ。それ以外を確かめたと判断するのは人のため（[V3](../../docs/values/v03-human-judgment.md)）。入れたときは根拠を報告に書き、人が確かめて外せるようにする。決まりは `references/ai-check-lines.md` にある。

### `issue-start` の要件の詰め方

決めることを依存関係の木にし、前提が決まった問いだけを回ごとにまとめて聞く。考え方は [mattpocock/skills の grilling](https://github.com/mattpocock/skills/blob/main/docs/productivity/grilling.md) を参考にした。別のプラグインのため呼び出さず、手順に書き込んでいる（[P5](../../docs/policies/p05-standalone-plugin.md)）。

### ブランチ名の `/` は `-` に置き換える

`tmp/<ブランチ名>/` への出力の規則（スキル名のサブディレクトリ・作業ファイルの置き場所）は [P4](../../docs/policies/p04-tmp-output.md) に従う。`allowed-tools` の書き込み先は、1 階層だけに当たる `tmp/*/` で書く。サブディレクトリに書くスキルは、`tmp/*/<スキル名>/` と 2 階層を書く。

ワークフロー（`.js`）にはこの README を読ませにくい。そのため、各スキル・ワークフローにも同じ 1 文を書いている。規約を変えるときは、次の箇所もそろえて直す。

- `skills/` の `ai-report`・`commit`・`docs-sync`・`harness-audit`・`issue-pr-sync`・`issue-start`・`pr-create` の `SKILL.md`
- `skills/ai-report/scripts/analyze.py` の `out_dir()`
- `workflows/` の `pr-review.js`・`harness-audit-run.js`
- `project` の `init-repo` が配る `.claude/rules/tmp-output.md`（このリポジトリの `.claude/rules/tmp-output.md` と組）。サブディレクトリに書くスキルを増やす・改名するときも直す

### `tmp/` の除外が無くても書き、利用者に伝える

`tmp/`・`tmp.md` に書くスキルは、書く前に `.gitignore` で除外されているかを確かめる。除外が無くても止めずに書き、足すと混ざらないと伝える。既にある `tmp.md` は、上書きの前に聞く。`.gitignore` は利用者が直す。手順は `references/tmp-ignore.md` にある。

`tmp/` に書くスキル・ワークフローを足すときは、この確かめも入れる。ワークフローは `references/` を読めないため、`pr-review.js` は Context の段で確かめ、戻り値の `tmpNote` で伝える。

### Issue 番号を省いたら、ブランチ名から取る

`pr-create`・`issue-pr-sync` は、Issue 番号を省くと、ブランチ名の `issues/<番号>-` か `hotfix/<番号>-` から番号を取る。取れなければ質問する。`issue-start` が作るブランチ名（`issues/<番号>-<説明>`）と組み合わせ、番号を調べて渡す手間を省くため。`issue-pr-sync` は Issue を直接書き換えるため、PR 本文の Issue への参照と食い違うときは、反映の前に聞く。`pr-review` も、PR 本文に Issue への参照が無ければ、ブランチ名が `issues/<番号>-` か `hotfix/<番号>-` の形のときだけ番号を取る。ほかの形なら、番号を推測せず Issue 無しでレビューする。

ブランチ名の形を変えるときは、次の箇所もそろえて直す。

- `skills/` の `pr-create`・`issue-pr-sync` の `SKILL.md` と、`issue-start` の `branch-setup.md`
- `workflows/` の `pr-review.js`
- `project` の `init-repo` が配る `.claude/rules/branch.md`（このリポジトリの `.claude/rules/branch.md` と組）

### Issue・PR の本文は 500 文字以内にする

`pr-create`・`issue-start`・`issue-pr-sync` は、本文を 500 文字以内、1 文・1 項目を 50 文字以内で書く。書いたら `scripts/body_length.js` で数える。長い本文は読まれないため（[P8](../../docs/policies/p08-short-body.md)）。上限と数え方は `references/short-body.md` にある。

### 点検レポートは同じ構成にする

`docs-sync`・`pr-review`・`harness-audit` のレポートは、同じ見出しの構成にする。3 つを同じ順で読めるようにするため。正典は `references/report-format.md`。ワークフローはファイルを読めないため、プロンプトに写しを持つ。決まりを変えるときは、次の箇所もそろえて直す。

- `references/report-format.md`
- `skills/docs-sync/output-template.md`
- `workflows/pr-review.js` の Report の段
- `workflows/harness-audit-run.js` の Report の段

### 出力先のパスは、前後を区切って伝える

書き出したファイルのパスを伝えるときは、パスの前後を半角スペースか改行で区切る（例：「レポート： `tmp/<ブランチ名>/pr-review_<ts>.md`」）。全角の「：」などがパスに続くと、その文字までリンクに含まれ、Ctrl + クリックで開けないため。

ワークフローにはこの README を読ませにくい。そのため、各スキル・ワークフローにも同じ 1 文を書いている。規約を変えるときは、次の箇所もそろえて直す。

- `skills/` の `ai-report`・`docs-sync`・`harness-audit`・`pr-create` の `SKILL.md`
- `skills/issue-pr-sync/result-format.md`・`skills/issue-start/result-template.md`
- `workflows/pr-review.js` の戻り値

### ハーネス監査は、設計思想を物差しにし、実行前に見込みを示す

`harness-audit` は、リポジトリがこのマーケットプレイスの設計思想に合うかを見る。範囲を全体にすると最終チェックになり、init-repo から作り直した後や、統合ブランチへのマージ前に使う。差分やディレクトリに絞ると、PR の前に、ブランチで変えたファイルだけを安く見られる。

- 物差し：利用先には `docs/values`・`docs/policies` が配られないため、要点を `references/harness-principles.md` に同梱する（[P5](../../docs/policies/p05-standalone-plugin.md)）。価値・方針・init-repo の土台を変えたら、この要約も直す
- 仕組みの欠け：存在するファイルを読むだけでは、土台の欠けに気づけない。そのため、init-repo の印があるリポジトリでは、要約の「土台の仕組み」を役割ごとに確かめる
- 範囲：全体・差分・ディレクトリから選ぶ。差分は `docs-sync` と同じく、マージ先と比べる（`references/base-branch.md`）。絞っても、規約のずれと仕組みの欠けは全体を見る。この 2 つは対象の一覧に依らず、リポジトリの規約から調べるため。範囲の外との値の矛盾・重複は見つからないため、レポートの注記に「範囲」と「見ていないもの」を書く
- 見込みの確認：Workflow は利用者に質問できないため、入口をスキルにし、件数・総量・エージェント数を示して続けるかを聞く。トークンを多く使うことは、見込みの前に伝える。費用がそのまま利用上限に数えられるため
- Workflow が使えないとき：入口のスキルが最初に確かめ、`/config` の「Dynamic workflows」を案内する。Pro では初期設定でオフのため
- モデル：`workflows/harness-audit-run.js` の `MODELS` で段ごとに固定する。呼ぶ人のモデルで費用が変わらないようにするため。判断の段は opus にし、質を落とさない（[V1](../../docs/values/v01-quality-over-speed.md)）。数の多い検査は sonnet にし、誤検出は検証の段で落とす
- 束ねる：エージェントは 1 体ごとに共通の前提を読むため、体数がそのまま費用になる。小さいファイルは束ねて 1 体で検査する（`BATCH`）
- 2 段の突合：1 体が読む事実が多すぎると取りこぼすため、件数が多いときは、ディレクトリの群ごとに突き合わせてから全体で突き合わせる（`DETECT_GROUP`）

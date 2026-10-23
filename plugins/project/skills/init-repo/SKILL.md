---
name: init-repo
description: リポジトリに Claude Code のハーネス設定（.claude/settings.json・hooks・rules）と GitHub の定型ファイル（.github/）、エディタ設定（.vscode/）・スペルチェックの設定（cspell.json）・Lint と整形のツールの定義（lefthook.yml）・.gitignore、CLAUDE.md / README.md の骨組みを導入する。新しいリポジトリを立ち上げる時、または既存リポジトリへ規約一式を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*), Bash(gh issue view:*), Bash(gh pr view:*)
argument-hint: "[導入する範囲・既存ファイルの扱い・Lint と整形のツール（任意。省略時はテンプレート全体が対象で、ツールは既存の設定を探し、無ければ聞く。例: .github だけ / 必要なものだけ / 既存は置き換えない / 整形は oxfmt）]"
---

# リポジトリ初期セットアップ（init-repo）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/init-repo/files/`）を実行中のリポジトリのルートへコピーし、エディタ設定・Lint と整形のツール・スペルチェックの除外語をプロジェクトに合わせる。**既存ファイルは承認なしに上書きしない**。

- 外へ書き込むもの：リポジトリのルートへのテンプレートのコピーと、承認を得たマージ・追記（`CLAUDE.md`・`README.md`・`.gitignore`・`.vscode/`・`cspell.json`・`lefthook.yml` など）。Claude が入れると選ばれたときは、ツールの導入（`package.json`・`node_modules`、または OS のパッケージ管理）
- 人がすること：導入計画と書き込みの承認、`DIFF` の扱いの選択、ツールを自分で入れるかの選択、コミット、導入後の作業（手順 6）。フックは `jq` を使い、無いと失敗する。編集後の Lint・整形は lefthook で動かし（最低の版は `README.md` の「前提と制約」）、無いとフックは何もしない

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/references/install-flow.md` | 手順 1〜4 で、状態の確認・計画の提示・コピー・衝突の片付けをするとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/template-inventory.md` | 引数で範囲を絞るとき・同じ役割の既存物を探すとき・手順 2 で入れないものを決めるとき（ほかの commitlint の設定や lefthook の別名の設定が既にあるかを、この一覧で確かめる） |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/merge-policy.md` | 手順 4 で `DIFF` のファイルがあるとき（選択肢を示す前から）・既存の `CLAUDE.md` があるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/tooling.md` | 手順 2 でツールの入れ方を示すとき・手順 5 |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/after-install.md` | 手順 6 |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/README.md` | 収録物・除外したもの・導入後の調整を確かめるとき。手順 6 で、lefthook の最低の版を伝えるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | Markdown を書く・直すとき。その規約に従う |

## 想定している引数

引数は「どのファイルを入れるか」の指定として読む。省略時はテンプレート全体が対象。範囲・既存物・ツールの指定を組み合わせられる（例：`必要なものだけ・既存は置き換えない`）。迷う指定は、対象ファイルの一覧を見せて確かめる。

| 種類 | 引数の例 | 扱い |
| --- | --- | --- |
| 範囲：パス指定 | `.github だけ` / `.claude/hooks を除く` / `.vscode と .gitignore` | 指定のパス配下だけ、または指定のパス配下以外 |
| 範囲：必要性の判定 | `必要なものだけ` / `このプロジェクトに要るものだけ` | `template-inventory.md` の「入れる条件」を満たすファイルだけ |
| 範囲：要件からの逆算 | `docs/spec.md の要件を満たす最小限` / `<URL> の要求を満たすものは最低限入れて` | 参照先の要件を満たすのに要るファイルだけ（`template-inventory.md` の「要件から逆算する」） |
| 既存物 | （指定なし） | `DIFF` は手順 4 で 1 件ずつ選んでもらう |
| 既存物 | `既存は置き換えない` / `既に作ってるものは触らないで` | `DIFF` はすべて据え置き、手順 4 を飛ばす。同じ役割の既存物があるテンプレートも外す（`template-inventory.md`） |
| 既存物 | `README は据え置き` | 指定のファイルだけ据え置き（`DIFF` でもマージしない） |
| ツール | `整形は oxfmt` | Lint・整形に使うツール。手順 5 で使う |

## 手順

### 1. 現状を確かめる

`install-flow.md` の「状態を確かめる」に従い、`--skill init-repo --check` で各ファイルの状態を見る。範囲を絞る引数があれば、結果から対象ファイルの相対パスを確定する。

### 2. 導入計画を示して承認を得る（必須）

`install-flow.md` の「導入計画を示す」に従って示し、承認を得る。

- 範囲を絞った場合（必要性の判定・要件からの逆算・同じ役割の既存物による除外）は、全テンプレートについて「入れる / 入れない」と**その理由**を表で示す。要件からの逆算では、要件とファイルの対応表と「テンプレートに無い」要件も示す
- `CLAUDE.md` / `README.md` が既にあれば、ほぼ確実に `DIFF` になる。**テンプレートで上書きすると既存の記述が失われる**ことを明示してから承認を求める
- `NEW` でも入れないもの（ほかの commitlint の設定・lefthook の別名の設定があるとき）を、`template-inventory.md` の「NEW でも入れないもの」で決める
- lefthook と入れ方（`tooling.md` の「ツールを入れる」）を示し、「自分で入れる / Claude が入れる」を選んでもらう。手順 5 で決めるツールにも、同じ選択を当てる
- `docs/log/` を入れるかを、利点（後任が経緯を時系列で引き継げる）を添えて聞く

### 3. コピーする

`install-flow.md` の「コピーする」に従う。範囲を絞った場合・手順 2 で入れないものを決めた場合・利用者が一部だけを希望した場合は、`--only` に `NEW` のファイルだけを並べる。`DIFF` のファイルは手順 4 で扱う。`docs/log/` を入れないときは、`docs/log/README.md` を外す。コピーした `docs/README.md` の表の行と「書き方」の箇条書き、`CLAUDE.md` のディレクトリの図の行からも `log/` を消し、図で一つ上の `runbook/` の行の `├──` を `└──` に直す。

### 4. 衝突したファイルを片付ける

`install-flow.md` の「衝突したファイルを片付ける」に従い、`DIFF` の扱いを 1 件ずつ選んでもらう。マージは `merge-policy.md` の方針で行う。`既存は置き換えない` の指定でこの手順を飛ばすときも、`.gitignore` の不足行の追記と、`CLAUDE.md` の `docs-type` の節を外すことは提案する。

### 5. エディタ設定・Lint と整形のツール・スペルチェックの除外語を調整する

`.vscode/`・`cspell.json`・`lefthook.yml` を入れた（または既にある）場合は、`tooling.md` に従って中身を提案する。どれも**一覧を見せて承認を得てから**書き込む。手順 2 で「Claude が入れる」が選ばれていれば、書き込んだ後に `tooling.md` の「ツールを入れる」に従って入れ、編集後の Lint が動くかを確かめる。

### 6. 導入後にやることを伝える

`after-install.md` の残作業を示す。最後に、手順 2 と同じテンプレートのリンクを添える。

### 7. 続けて使うスキルを聞く

ここまでは技術に依らない土台である。言語・インフラの構成と規約は、技術スタック別のスキル（このプラグインの `init-repo` 以外）が入れるため、続けて使うスキルを聞く。引数がパス指定（`.github だけ` など）のときは、土台の一部を足す実行のため、聞かずに終える。

1. `${CLAUDE_PLUGIN_ROOT}/skills/*/SKILL.md` を Glob し、`init-repo` 以外の frontmatter の `name`・`description` を読む
1. `description` が対象にする技術と、リポジトリのファイル（例：`*.tf`・`.clasp.json`・`wp-content/`）から、当てはまるスキルを判定する
1. `AskUserQuestion`（`multiSelect: true`）で聞く。選択肢はスキルと「使わない」にし、当てはまるスキルを先頭に置いてラベルに「（推奨）」を付ける。1 問の選択肢は 4 つまでのため、スキルが 3 つを超えたら問いを分ける
1. 選ばれたスキルのコマンド（`/project:<name>`）を、貼れる形で並べて示す。技術スタック別のスキルは手動でのみ呼ぶ設計（`disable-model-invocation: true`）のため、Claude は実行しない

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- テンプレートに含まれないディレクトリを承認なしに作らない（README の本文を `docs/` 配下へ移す場合も、移動先を承認してもらってから作る）
- コピー結果をコミットしない（コミットは人が行う）
- npm で lefthook を入れるときに、`--ignore-scripts` を外さない（`.git/hooks` が書き換わる）

## 保守

- 手順 7 に、スキルの一覧を書かない。スキルが増えても古くならないようにするため
- `allowed-tools` の `gh issue view`・`gh pr view` は、要件からの逆算で Issue・PR を読むためのもの
- lefthook の最低の版は、`README.md` の「前提と制約」だけに書く。ほかの文書には書かず、README を指す
- cspell の版は、`files/.github/workflows/pr-checks.yml` と `tooling.md` のコマンドの 2 か所に書く。コマンドに版が要るため、上げるときは両方をそろえる

$ARGUMENTS

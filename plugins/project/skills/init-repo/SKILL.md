---
name: init-repo
description: リポジトリに Claude Code のハーネス設定（.claude/settings.json・hooks・rules）と GitHub の定型ファイル（.github/）、エディタ設定（.vscode/）・スペルチェックの設定（cspell.json）・Lint と整形のツールの定義（lefthook.yml）・.gitignore、CLAUDE.md / README.md の骨組みを導入する。新しいリポジトリを立ち上げる時、または既存リポジトリへ規約一式を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*), Bash(gh issue view:*), Bash(gh pr view:*)
argument-hint: "[導入する範囲・既存ファイルの扱い・Lint と整形のツール（任意。省略時はテンプレート全体が対象で、ツールは既存の設定を探し、無ければ聞く。例: .github だけ / 必要なものだけ / 既存は置き換えない / 整形は oxfmt）]"
---

# リポジトリ初期セットアップ（init-repo）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/init-repo/files/`）を、実行中のリポジトリのルートへコピーする。**既存ファイルは承認なしに上書きしない**。

Markdown の書式は `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` を Read し、その規約に従う。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` | 状態判定（NEW / SAME / DIFF）とコピーの実行。project プラグインの全 Skill で共有するため、`--skill init-repo` で対象を指定する |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/files/` | コピー元のテンプレート一式 |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/README.md` | 収録物の一覧・除外したものとその理由・導入後の調整項目 |

## 前提条件

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること
- 導入するフックは実行時に [`jq`](https://jqlang.org/) を使う。未インストールの環境ではフックが失敗する
- 編集後の Lint・整形は [lefthook](https://lefthook.dev/)（1.6.11 以降）で動かす。未インストールの環境では、フックは何もしない

## 引数の解釈

引数は「どのファイルを入れるか」の指定として読む。省略時はテンプレート全体が対象。指定は次の 3 種類を組み合わせられる（例：`必要なものだけ・既存は置き換えない`）。

- **範囲の指定**：どのファイルを候補にするか（パス指定・必要性の判定・要件からの逆算）
- **既存物の扱い**：既にあるものをどうするか
- **ツールの指定**：Lint・整形に使うツール（例：`整形は oxfmt`）。手順 5 で使う

迷う指定は、対象ファイルの一覧を見せて確認する。

### 範囲の指定

| 引数の例 | モード | 対象の決め方 |
| --- | --- | --- |
| `.github だけ` / `.claude/hooks を除く` / `.vscode と .gitignore` | パス指定 | 指定のパス配下だけ、または指定のパス配下以外 |
| `必要なものだけ` / `このプロジェクトに要るものだけ` | 必要性の判定 | 下記「テンプレートの収録物と要否の判定」の「入れる条件」を満たすファイルだけ |
| `docs/spec.md の要件を満たす最小限` / `<URL> の要求を満たすものは最低限入れて` | 要件からの逆算 | 参照先の要件を満たすのに要るファイルだけ（下記の手順で決める） |

**要件からの逆算**は次の順で進める。

1. 参照先を読む。リポジトリ内のパスは Read、URL は WebFetch で読む。GitHub の Issue・PR の URL は `gh issue view` / `gh pr view` で読む（非公開リポジトリは WebFetch で読めないため）。読めなかった場合は推測で進めず、ユーザーに内容の貼り付けを頼む
1. 参照先から、リポジトリの設定・規約に関わる要件を箇条書きで抜き出す（例：「秘匿情報をコミットしない」「PR にテンプレートを使う」「コミットは Conventional Commits」）。アプリの機能要件など、テンプレートと無関係なものは拾わない
1. 要件ごとに、満たすテンプレートのファイルを表にする。どのファイルでも満たせない要件は「テンプレートに無い」と明記する（無理に近いファイルを当てない）
1. 表に挙がったファイルと、その依存先（下記「依存関係」）だけを対象にする

範囲を絞った場合は、手順 1 の `--check` 結果から対象ファイルの相対パスを確定し、手順 3 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。`DIFF` のファイルは手順 4 で扱う。

### 既存物の扱い

| 引数の例 | 扱い |
| --- | --- |
| （指定なし） | 同じパスの既存ファイル（`DIFF`）は手順 4 で 1 件ずつ「上書き / 手でマージ / 据え置き」を選んでもらう |
| `既存は置き換えない` / `既に作ってるものは触らないで` | `DIFF` はすべて据え置き、手順 4 を飛ばす。加えて、パスが違っても同じ役割のものが既にあるテンプレートは対象から外す（下記） |
| `README は据え置き` | 指定のファイルだけ据え置き（`DIFF` でもマージしない） |

**同じ役割の既存物**は、下記の表の「同じ役割の既存物の例」を手がかりに Glob / Read で探す。見つかったら、そのテンプレートを対象から外し、手順 2 の計画で「既存の〇〇があるため入れない」と理由を添えて示す。判断がつかない場合（既存物が一部の役割しか果たしていない等）は、外すか入れるかをユーザーに確認する。

### テンプレートの収録物と要否の判定

「必要性の判定」と「同じ役割の既存物」の探索に使う。

| テンプレート | 満たす要件 | 入れる条件 | 同じ役割の既存物の例 |
| --- | --- | --- | --- |
| `.claude/settings.json` | Claude Code の権限（秘匿ファイルの deny・コミット / push・削除・権限の変更・深刻な外部操作の deny）・フックの配線と、Python のキャッシュを作らない環境変数 | Claude Code を使う（常に該当） | `.claude/settings.json` |
| `.claude/hooks/guard-destructive.sh` | 破壊的コマンドの承認エスカレーション | `settings.json` を入れる | 既存の PreToolUse フック |
| `.claude/hooks/post-edit-lint.sh` | 編集後の Lint・整形（推論と機械の検査の分担） | ソースコードがある | 既存の PostToolUse フック |
| `lefthook.yml` | Lint・整形のツールの定義（`post-edit-lint.sh` が使う） | `post-edit-lint.sh` を入れる | `lefthook.yml`・`lefthook.yaml`・`.lefthook.yml`・`.lefthook.yaml`（`claude-edit` を足す） |
| `.claude/hooks/session-start.sh` | セッション開始時の運用ルール通知 | `settings.json` を入れる | 既存の SessionStart フック |
| `.claude/hooks/guard-git-write.sh` | ラッパー経由まで含めた git / gh 書き込みの遮断 | 要件に明記がある場合のみ（既定では未配線） | 同等の PreToolUse フック |
| `.claude/rules/comment.md` | コメントの書き方の規約 | ソースコードがある | `CLAUDE.md`・`.claude/rules/` 内のコメント規約 |
| `.claude/rules/env.md` | 環境変数と `*.example` の追従 | `.env*` / `*.example` を使う | `CLAUDE.md` 等の環境変数の規約 |
| `.claude/rules/github-actions.md` | ワークフローの安全な書き方 | `.github/workflows/` がある、または入れる | 同等の規約 |
| `.claude/rules/readme.md` | README を案内板として運用する | `README.md` を入れる、またはドキュメントが複数ある | 同等の規約 |
| `.claude/rules/adr.md` | 判断の前に ADR の一覧を見る・判断を ADR に残すか聞く | `docs/adr/README.md` を入れる | `CLAUDE.md`・`.claude/rules/` 内の ADR の規約 |
| `.claude/rules/permissions.md` | 権限の線引き（Claude に任せる操作と人が行う操作）と、deny・フックを変えるときの決まり | `settings.json` を入れる | `CLAUDE.md`・`.claude/rules/` 内の権限の規約 |
| `.claude/rules/branch.md` | ブランチ名を Issue 番号と作業の要点にそろえる | GitHub で Issue を使う | `CLAUDE.md`・`.claude/rules/`・`CONTRIBUTING.md` 内のブランチ名の規約 |
| `.claude/rules/tmp-output.md` | `tmp/<ブランチ名>/` の置き方（スキルの出力と Claude の作業ファイルを分ける） | Claude Code を使う（常に該当） | `CLAUDE.md`・`.claude/rules/` 内の `tmp/` の規約 |
| `.claude/rules/ai-docs.md` | AI が読む文書（`SKILL.md`・規約・`CLAUDE.md`）を、人も読み切れる形で書く | Claude Code を使う（常に該当） | `CLAUDE.md`・`.claude/rules/` 内の文書の書き方の規約 |
| `.github/ISSUE_TEMPLATE/` | Issue の起票形式 | GitHub で Issue を使う | `.github/ISSUE_TEMPLATE/`・`.github/issue_template.md` |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 本文の形式 | GitHub で PR を使う | `.github/pull_request_template.md`・`docs/pull_request_template.md`・ルートの `PULL_REQUEST_TEMPLATE.md` |
| `.github/dependabot.yml` | GitHub Actions の依存更新 | `.github/workflows/` がある、または入れる | `.github/dependabot.yml`・`renovate.json`・`.github/renovate.json` |
| `.github/labels.yml` + `.github/workflows/sync-labels.yml` | ラベルのコード管理 | ラベルを運用する（Issue テンプレートを入れる場合は必須） | 既存のラベル同期ワークフロー |
| `.github/workflows/pr-checks.yml` | PR 差分のシークレットスキャン・リポジトリ全体のスペルチェック | GitHub で PR を使う | gitleaks・trufflehog・cspell 等を使う既存ワークフロー・pre-commit フック |
| `.vscode/extensions.json` / `.vscode/settings.json` | エディタの推奨拡張機能・保存時の整形 | VS Code を使う（`.vscode/` がある・チームで VS Code を使う） | `.vscode/` |
| `cspell.json` | スペルチェックの設定と除外語（VS Code の拡張機能と CI が共有する） | `pr-checks.yml` か `.vscode/` を入れる | cspell の別名の設定ファイル（`.cspell.json`・`cspell.jsonc`・`cspell.yaml`・`cspell.config.*`・`.config/cspell.*`・`.vscode/cspell.json`）・`package.json` の `cspell` キー |
| `.gitignore` | 作業ファイル・秘匿ファイルの除外 | git リポジトリ（常に該当） | `.gitignore`（据え置き時も不足行の追記は提案する） |
| `commitlint.config.mjs` | Conventional Commits の検証 | Node.js のプロジェクトで、コミット規約を機械的に検証したい | `commitlint.config.*`・`.commitlintrc*`・`package.json` の `commitlint` キー |
| `docs/README.md` | ドキュメントの案内板 | `docs/` がある、または作る | `docs/` 以外の文書置き場（`doc/`・`documentation/`・Wiki） |
| `docs/adr/README.md` | ADR の一覧（`CLAUDE.md` が読み込む） | `CLAUDE.md` を入れる | `doc/adr/`・`docs/decisions/`・`adr/` の一覧 |
| `CLAUDE.md` | Claude Code 向けのガイド | Claude Code を使う（常に該当） | `CLAUDE.md`・`.claude/CLAUDE.md`・`AGENTS.md` |
| `README.md` | リポジトリの入口（案内板） | 常に該当 | `README.md`・`README.*` |

### 依存関係

一方だけ入れると動かない組み合わせ。範囲を絞ったときも、片方を入れるならもう片方も入れる（既にあればよい）。

- `.claude/settings.json` は `guard-destructive.sh`・`post-edit-lint.sh`・`session-start.sh` を呼ぶ。フックを外す場合は、`settings.json` の該当の `hooks` 定義も外す必要があるため、計画で明示する
- `.claude/hooks/post-edit-lint.sh` は `lefthook.yml` の `claude-edit` を動かす。`lefthook.yml` が無いと、何もしない
- `.github/workflows/sync-labels.yml` は `.github/labels.yml` を読む
- `.claude/rules/tmp-output.md` は、`.gitignore` の `tmp/` を前提にする。`tmp/` が除外されていないと、作業ファイルがコミットに混ざる
- `CLAUDE.md` の `@docs/adr/README.md` と `.claude/rules/adr.md` は、`docs/adr/README.md` を読む。入れないときは、取り込みの行と `adr.md` も外す。ADR を別の場所（`doc/adr/`・`docs/decisions/` など）に置いているときは、取り込みの行と `adr.md` のパスをその場所に直す
- `.github/workflows/pr-checks.yml` のスペルチェックは `cspell.json`（除外語・検査対象）を読む。無いと、テンプレート自身の語（`aidd`・`ssot` 等）も誤字として出て、PR のチェックが落ちる
- Issue テンプレートの `labels:` は `labels.yml` のラベルを前提にしている

## 手順

### 1. 現状を確認する

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill init-repo --check
```

出力は 1 行 1 ファイル。ラベルの意味は次のとおり。

| ラベル | 意味 |
| --- | --- |
| `NEW` | 導入先に存在しない。コピー対象 |
| `SAME` | 既存ファイルと内容が一致。何もしない |
| `DIFF` | 既存ファイルと内容が異なる。**自動では触らない** |

### 2. 導入計画を提示して承認を得る（必須）

`--check` の結果を、次の 3 つに分けてユーザーへ提示する。

- これから新規作成するファイル（`NEW`）
- 既存のまま残すファイル（`SAME`）
- 衝突していて判断が要るファイル（`DIFF`）

引数で範囲を絞った場合（必要性の判定・要件からの逆算・同じ役割の既存物による除外）は、全テンプレートについて「入れる / 入れない」と**その理由**を表で示す。要件からの逆算では、要件とファイルの対応表と「テンプレートに無い」要件も併せて示す。

`CLAUDE.md` / `README.md` が既にあるリポジトリでは、ほぼ確実に `DIFF` になる。**テンプレートで上書きすると既存の記述が失われる**ことを明示したうえで承認を求める。

`commitlint.config.mjs` は `NEW` でも、ほかの commitlint の設定（`commitlint.config.*`・`.commitlintrc*`・`package.json` の `commitlint` キー）があれば入れない。前の版の `init-repo` が配った `commitlint.config.js` もこれに当たる。設定が 2 つあると、どちらが読まれるか分かりにくいため。手順 3 では `--only` でこのファイルを外してコピーする。

`lefthook.yml` も `NEW` でも、別名の設定（`lefthook.yaml`・`.lefthook.yml`・`.lefthook.yaml`）があれば入れない。両方あると lefthook は `lefthook.yml` だけを読み、既存の設定の検査が黙って止まるため。手順 3 では `--only` でこのファイルを外してコピーし、手順 5 で既存の設定に `claude-edit` を足す。

ユーザーが一部だけを希望した場合は、`--only` で対象を絞る（手順 3）。

テンプレートの中身を確かめられるよう、`https://github.com/Kazu-K0032/claude-plugins/tree/v<版>/plugins/project/skills/init-repo/files` も示す。`<版>` は `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` の `version` にする。入れている版と同じ中身を見せるため。リリース前の版ではタグが無く、開けない。

### 3. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill init-repo --apply
```

対象を絞る場合、または `DIFF` のファイルを上書きする場合は `--only` に相対パスを列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill init-repo --apply --only .github/labels.yml .claude/rules/comment.md
```

### 4. 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。`既存は置き換えない` の指定があるときはこの手順を飛ばし、`DIFF` をすべて据え置く（`.gitignore` の不足行の追記だけは提案する）。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/init-repo/files/<同じ相対パス>"
```

`CLAUDE.md` は、テンプレートの見出し構成に既存の記述を差し込む形でマージするのが基本。既存の内容を捨てない。既存の `CLAUDE.md` に `docs-type` の節（「`.claude/` ファイルのメタデータ規約」）があれば、選んだ扱いや `既存は置き換えない` の指定に関わらず、外すことを提案する。前の版が配った節で、AI 向けの文書は人が読めなくてよいとしており、`.claude/rules/ai-docs.md` と食い違うため。

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `README.md` | 案内板に作り替える（下記） |
| `.gitignore` | 既存の行は残し、テンプレートにあって既存に無い行だけを末尾へ追記する |
| `.vscode/settings.json` / `.vscode/extensions.json` | 既存のキー・配列要素は残し、無いものだけを足す。JSONC（コメント・末尾カンマ）を壊さない。既存の `cSpell.words` は cspell の CLI が読まないため、`cspell.json` の `words` へ移すことを提案する |
| `cspell.json` | 既存のキー・`words` の語は残し、無いものだけを足す |
| `.claude/settings.json` | 既存のキー・配列要素は残し、無いものだけを足す。`env` の `PYTHONDONTWRITEBYTECODE` も足す |
| `lefthook.yml` | 既存のフック（`pre-commit` など）は残し、`claude-edit` が無ければ足す。名前の違う設定（`.lefthook.yml` など）があれば、そちらに足す |

#### README.md を案内板にする

README は「どこに何があるか」を示す案内板として扱う（`.claude/rules/readme.md`）。既存の README に本文（環境構築の手順・設計の説明・API の説明など）がある場合は、次の順で作り替える。

1. 既存 README の見出しごとに、移動先の候補を表で提示する（例：環境構築 → `docs/runbook/environment-setup.md`、設計 → `docs/architecture/architecture.md`）。移動先は `docs/README.md` の振り分け表に従う
2. ユーザーの承認を得てから、本文を移動先へそのまま移す（要約・削除しない）。移動先のサブディレクトリを新しく作る場合は、同時にその `README.md`（案内板）も置く
3. ルートの `README.md` はテンプレートの構成に合わせる。移した本文へのリンクは、ルートではなく移動先の案内板（`docs/README.md` やサブディレクトリの `README.md`）に置き、ルートからは `docs/README.md` だけを案内する。概要（1〜2 行）・各環境のリンク・外部リンクなど、リンク集として残せる情報はそのまま残す

### 5. エディタ設定・Lint と整形のツール・スペルチェックの除外語を調整する

`.vscode/`・`cspell.json`・`lefthook.yml` を導入した（または既にある）場合は、プロジェクトに合わせて中身を提案する。どれも**一覧を見せて承認を得てから**書き込む。

#### 推奨拡張機能（`.vscode/extensions.json`）

ルートのファイルから技術スタックを判定し、`recommendations` に足す拡張機能を提案する。

| 判定に使うファイル | 提案する拡張機能の例 |
| --- | --- |
| `package.json`（`eslint` / `prettier` / `typescript` / `tailwindcss` 等の依存） | `dbaeumer.vscode-eslint`・`esbenp.prettier-vscode`・`bradlc.vscode-tailwindcss` |
| `pyproject.toml` / `requirements.txt` | `ms-python.python`・`charliermarsh.ruff` |
| `go.mod` | `golang.go` |
| `Cargo.toml` | `rust-lang.rust-analyzer` |
| `*.tf` | `hashicorp.terraform` |
| `Dockerfile` / `compose.yaml` | `ms-azuretools.vscode-docker` |

表にない技術は、公式に推奨されている拡張機能を調べてから提案する。拡張機能 ID の推測で書かない。

#### Lint と整形のツール（`lefthook.yml` の `claude-edit`）

土台が持つのは、推論（Claude）と機械の検査を分ける仕組みだけである。どのツールを使うかはプロジェクトが決めるため、次の順で決めて `claude-edit` の `commands` に足す。別名の設定（`.lefthook.yml` など）を使っているときは、そのファイルに足す。`claude-edit` が無ければ、`piped: true` と一緒に定義ごと足す。

1. 引数でツールを指定されていれば、それを使う
1. 指定が無ければ、既存の設定を Glob で探す（例：`biome.json`・`.oxlintrc.json`・`eslint.config.*`・`.prettierrc*`・`ruff.toml`・`pyproject.toml`・`.golangci.*`、`package.json` の `scripts` の `lint`・`format`）。あれば、それを使う
1. どちらも無ければ、`AskUserQuestion` で候補を出す。「使わない」も選択肢に入れる。候補は、公式の文書で今の状態（安定版か・最新の版）を確かめてから出す。状態や版を推測で書かない。JS/TS の例：整形は oxfmt（ベータ）、Lint は oxlint、両方を 1 つで扱う Biome

`commands` は次の決まりで書く。

- 整形のツールはファイルを書き換える形にし、`priority: 1` にする。Lint のツールは、警告でも 0 以外で終える形（例：oxlint の `--deny-warnings`）にし、`priority: 2` にする。失敗した結果だけが Claude に返る
- ツールが入っていないときは黙って飛ばす。`npm` で入れたツールは PATH に無いため、`node_modules/.bin/` の下を指す
- `run` に二重引用符を書かない。Windows では、二重引用符を含むコマンドが崩れる。全体を単一引用符で囲む
- ツールの置き場所がルートでないときは、`root` にそのディレクトリを書く。`{staged_files}` は `root` からの相対パスになる。`glob` は `root` に関係なく、リポジトリのルートから数える

```yaml
claude-edit:
  piped: true
  commands:
    format:
      priority: 1
      glob: "*.{js,jsx,ts,tsx}"
      run: '[ -x node_modules/.bin/oxfmt ] || exit 0; node_modules/.bin/oxfmt {staged_files}'
    lint:
      priority: 2
      glob: "*.{js,jsx,ts,tsx}"
      run: '[ -x node_modules/.bin/oxlint ] || exit 0; node_modules/.bin/oxlint --deny-warnings {staged_files}'
```

ツールの導入（`npm install` など）は人が行う。手順 6 で伝える。

#### スペルチェックの除外語（`cspell.json` の `words`）

除外語は `.vscode/settings.json` の `cSpell.words` ではなく `cspell.json` に置く。VS Code の拡張機能と cspell の CLI（`pr-checks.yml` のスペルチェック）の両方が読むのは `cspell.json` だけのため。テンプレート自身が使う語（`aidd`・`ssot` 等）は登録済み。

次から固有名詞・技術用語の候補を集め、重複を除いて小文字で並べる。

- `package.json` などの依存パッケージ名・プロジェクト名
- ルート直下のディレクトリ名・主要なファイル名
- `README.md` / `CLAUDE.md` / `docs/` に出てくるサービス名・製品名・略語
- 上の小節で `lefthook.yml` に書いたツール名・オプション（PR のスペルチェックは `lefthook.yml` も検査する）

`npx` が使える環境では、次の結果も候補に加えてよい（初回はパッケージの取得が走る）。

```bash
npx --yes cspell@9.8.0 lint --no-progress --words-only --unique --dot --gitignore --exclude ".git/**" "**/*.{md,ts,tsx,js,jsx,py,go,rs,json,yml,yaml}"
```

- 版は `pr-checks.yml` のスペルチェックとそろえる。版を固定しないと最新版が使われ、最新版が要求する Node より手元の Node が古いと失敗する
- `--dot` は `.claude/`・`.github/` などドット始まりのディレクトリも対象にする（既定では検査しない）。`--exclude ".git/**"` は、そのときに `.git/` の中まで検査しないためのもの

一般的な英単語の誤字は候補から外す。除外語に入れるのは「正しい綴りだが辞書に無い語」だけ。`pr-checks.yml` を入れた場合、ここで登録しなかった語は PR のスペルチェックで誤字として出る。

### 6. 導入後にやることを伝える

コピーが終わったら、次を残作業としてユーザーに提示する。最後に、手順 2 と同じテンプレートのリンクを添える。

1. `CLAUDE.md` / `README.md` / `.claude/rules/env.md` の `TODO:` 行を、このリポジトリの実態に書き換える（埋めたら行ごと削除する）
2. `.claude/settings.json` の `permissions.deny` を、このリポジトリの秘匿ファイル配置に合わせる
3. lefthook（1.6.11 以降）と、手順 5 で `lefthook.yml` に書いたツールを入れる。lefthook は npm・Homebrew・winget などで入る（[導入の方法](https://lefthook.dev/install/)）。npm で入れると、Git のフックも入る。検査の対象を絞るときは、`.claude/hooks/post-edit-lint.sh` 冒頭の `TARGET_PREFIX` を直す
4. `.claude/hooks/guard-destructive.sh` の `patterns` に、このプロジェクト固有の破壊的操作（クラウド CLI の削除系・本番ホストへの接続等）を追記する
5. `commitlint.config.mjs` を使うなら、`@commitlint/cli` と `@commitlint/config-conventional` を devDependencies に追加し、`commit-msg` フックから呼ぶ（`lefthook.yml` の `commit-msg` に書ける）
6. `.github/workflows/` には「シークレットスキャン」「スペルチェック」「ラベル同期」しか入っていない。ビルド・テストの CI はプロジェクト側で作る
7. Issue テンプレートを入れたら、`.github/ISSUE_TEMPLATE/release.yml` の「事前確認」と「リリース手順」を、このリポジトリのデプロイの方式に合わせる。テンプレートは、検証環境があり、リリース用ブランチへのマージでデプロイワークフローが動く構成を前提にしている（例：`main` へのマージでホスティングが自動でデプロイするなら、リリース用ブランチとデプロイワークフローの行をその方式の手順に置き換える）

`guard-git-write.sh` は配線していない。`git commit` / `git push` をラッパースクリプト経由まで含めて塞ぎたい場合のみ、`settings.json` の `PreToolUse` に追加するよう案内する。

### 7. 続けて使うスキルを聞く

ここまでは技術に依らない土台である。言語・インフラの構成と規約は、技術スタック別のスキル（このプラグインの `init-repo` 以外のスキル）が入れる。そのため、続けて使うスキルを聞く。引数がパス指定（`.github だけ` など）のときは、土台の一部を足す実行のため、聞かずに終える。

1. `${CLAUDE_PLUGIN_ROOT}/skills/*/SKILL.md` を Glob し、`init-repo` 以外の frontmatter の `name`・`description` を読む。スキルの一覧はこの本文に書かない。スキルが増えても古くならないようにするため
1. `description` が対象にする技術と、リポジトリのファイル（例：`*.tf`・`.clasp.json`・`wp-content/`）から、当てはまるスキルを判定する
1. `AskUserQuestion`（`multiSelect: true`）で聞く。選択肢はスキルと「使わない」にし、当てはまるスキルを先頭に置いてラベルに「（推奨）」を付ける。1 問の選択肢は 4 つまでのため、スキルが 3 つを超えたら問いを分ける
1. 選ばれたスキルのコマンド（`/project:<name>`）を、貼れる形で並べて示す。技術スタック別のスキルは手動でのみ呼ぶ設計（`disable-model-invocation: true`）のため、Claude は実行しない

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- テンプレートに含まれないディレクトリを承認なしに作らない（README の本文を `docs/` 配下へ移す場合も、移動先を承認してもらってから作る）
- コピー結果をコミットしない（コミットは人が行う）

$ARGUMENTS

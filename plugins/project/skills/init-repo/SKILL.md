---
name: init-repo
description: リポジトリに Claude Code のハーネス設定（.claude/settings.json・hooks・rules）と GitHub の定型ファイル（.github/）、エディタ設定（.vscode/）・.gitignore、CLAUDE.md / README.md の骨組みを導入する。新しいリポジトリを立ち上げる時、または既存リポジトリへ規約一式を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*), Bash(gh issue view:*), Bash(gh pr view:*)
argument-hint: "[例: .github だけ / 必要なものだけ / 既存は置き換えない / docs/spec.md の要件を満たす最小限]"
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

## 引数の解釈

引数は「どのファイルを入れるか」の指定として読む。省略時はテンプレート全体が対象。指定は次の 2 種類を組み合わせられる（例：`必要なものだけ・既存は置き換えない`）。

- **範囲の指定**：どのファイルを候補にするか（パス指定・必要性の判定・要件からの逆算）
- **既存物の扱い**：既にあるものをどうするか

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
| `.claude/settings.json` | Claude Code の権限（秘匿ファイルの deny・git / gh 書き込みの deny）とフックの配線 | Claude Code を使う（常に該当） | `.claude/settings.json` |
| `.claude/hooks/guard-destructive.sh` | 破壊的コマンドの承認エスカレーション | `settings.json` を入れる | 既存の PreToolUse フック |
| `.claude/hooks/post-edit-lint.sh` | 編集後の Lint | Lint ツールがある（`package.json` の `lint` スクリプト・`ruff`・`golangci-lint` 等） | 既存の PostToolUse フック・lint-staged |
| `.claude/hooks/session-start.sh` | セッション開始時の運用ルール通知 | `settings.json` を入れる | 既存の SessionStart フック |
| `.claude/hooks/guard-git-write.sh` | ラッパー経由まで含めた git / gh 書き込みの遮断 | 要件に明記がある場合のみ（既定では未配線） | 同等の PreToolUse フック |
| `.claude/rules/comment.md` | コメントの書き方の規約 | ソースコードがある | `CLAUDE.md`・`.claude/rules/` 内のコメント規約 |
| `.claude/rules/env.md` | 環境変数と `*.example` の追従 | `.env*` / `*.example` を使う | `CLAUDE.md` 等の環境変数の規約 |
| `.claude/rules/github-actions.md` | ワークフローの安全な書き方 | `.github/workflows/` がある、または入れる | 同等の規約 |
| `.claude/rules/readme.md` | README を案内板として運用する | `README.md` を入れる、またはドキュメントが複数ある | 同等の規約 |
| `.github/ISSUE_TEMPLATE/` | Issue の起票形式 | GitHub で Issue を使う | `.github/ISSUE_TEMPLATE/`・`.github/issue_template.md` |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 本文の形式 | GitHub で PR を使う | `.github/pull_request_template.md`・`docs/pull_request_template.md`・ルートの `PULL_REQUEST_TEMPLATE.md` |
| `.github/dependabot.yml` | GitHub Actions の依存更新 | `.github/workflows/` がある、または入れる | `.github/dependabot.yml`・`renovate.json`・`.github/renovate.json` |
| `.github/labels.yml` + `.github/workflows/sync-labels.yml` | ラベルのコード管理 | ラベルを運用する（Issue テンプレートを入れる場合は必須） | 既存のラベル同期ワークフロー |
| `.github/workflows/pr-checks.yml` | PR 差分のシークレットスキャン | GitHub で PR を使う | gitleaks・trufflehog 等を使う既存ワークフロー・pre-commit フック |
| `.vscode/extensions.json` / `.vscode/settings.json` | エディタの推奨拡張機能・スペルチェックの除外語 | VS Code を使う（`.vscode/` がある・チームで VS Code を使う） | `.vscode/` |
| `.gitignore` | 作業ファイル・秘匿ファイルの除外 | git リポジトリ（常に該当） | `.gitignore`（据え置き時も不足行の追記は提案する） |
| `commitlint.config.js` | Conventional Commits の検証 | Node.js のプロジェクトで、コミット規約を機械的に検証したい | `commitlint.config.*`・`.commitlintrc*`・`package.json` の `commitlint` キー |
| `docs/README.md` | ドキュメントの案内板 | `docs/` がある、または作る | `docs/` 以外の文書置き場（`doc/`・`documentation/`・Wiki） |
| `CLAUDE.md` | Claude Code 向けのガイド | Claude Code を使う（常に該当） | `CLAUDE.md`・`.claude/CLAUDE.md`・`AGENTS.md` |
| `README.md` | リポジトリの入口（案内板） | 常に該当 | `README.md`・`README.*` |

### 依存関係

一方だけ入れると動かない組み合わせ。範囲を絞ったときも、片方を入れるならもう片方も入れる（既にあればよい）。

- `.claude/settings.json` は `guard-destructive.sh`・`post-edit-lint.sh`・`session-start.sh` を呼ぶ。フックを外す場合は、`settings.json` の該当の `hooks` 定義も外す必要があるため、計画で明示する
- `.github/workflows/sync-labels.yml` は `.github/labels.yml` を読む
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

ユーザーが一部だけを希望した場合は、`--only` で対象を絞る（手順 3）。

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

`CLAUDE.md` は、テンプレートの見出し構成に既存の記述を差し込む形でマージするのが基本。既存の内容を捨てない。

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `README.md` | 案内板に作り替える（下記） |
| `.gitignore` | 既存の行は残し、テンプレートにあって既存に無い行だけを末尾へ追記する |
| `.vscode/settings.json` / `.vscode/extensions.json` | 既存のキー・配列要素は残し、無いものだけを足す。JSONC（コメント・末尾カンマ）を壊さない |

#### README.md を案内板にする

README は「どこに何があるか」を示す案内板として扱う（`.claude/rules/readme.md`）。既存の README に本文（環境構築の手順・設計の説明・API の説明など）がある場合は、次の順で作り替える。

1. 既存 README の見出しごとに、移動先の候補を表で提示する（例：環境構築 → `docs/runbook/environment-setup.md`、設計 → `docs/architecture/architecture.md`）。移動先は `docs/README.md` の振り分け表に従う
2. ユーザーの承認を得てから、本文を移動先へそのまま移す（要約・削除しない）。移動先のサブディレクトリを新しく作る場合は、同時にその `README.md`（案内板）も置く
3. ルートの `README.md` はテンプレートの構成に合わせ、移した本文の代わりにリンクを置く。概要（1〜2 行）・各環境のリンク・外部リンクなど、リンク集として残せる情報はそのまま残す

### 5. エディタ設定を調整する

`.vscode/` を導入した（または既にある）場合は、プロジェクトに合わせて中身を提案する。どちらも**一覧を見せて承認を得てから**書き込む。

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

#### スペルチェックの除外語（`.vscode/settings.json` の `cSpell.words`）

次から固有名詞・技術用語の候補を集め、重複を除いて小文字で並べる。

- `package.json` などの依存パッケージ名・プロジェクト名
- ルート直下のディレクトリ名・主要なファイル名
- `README.md` / `CLAUDE.md` / `docs/` に出てくるサービス名・製品名・略語

`npx` が使える環境では、次の結果も候補に加えてよい（初回はパッケージの取得が走る）。

```bash
npx --yes cspell lint --no-progress --words-only --unique "**/*.{md,ts,tsx,js,jsx,py,go,rs,json,yml,yaml}"
```

一般的な英単語の誤字は候補から外す。除外語に入れるのは「正しい綴りだが辞書に無い語」だけ。

### 6. 導入後にやることを伝える

コピーが終わったら、次を残作業としてユーザーに提示する。

1. `CLAUDE.md` / `README.md` / `.claude/rules/env.md` の `TODO:` 行を、このリポジトリの実態に書き換える（埋めたら行ごと削除する）
2. `.claude/settings.json` の `permissions.deny` を、このリポジトリの秘匿ファイル配置に合わせる
3. `.claude/hooks/post-edit-lint.sh` 冒頭の `LINT_DIR` / `TARGET_PREFIX` を、lint ツールの置き場所に合わせる
4. `.claude/hooks/guard-destructive.sh` の `patterns` に、このプロジェクト固有の破壊的操作（クラウド CLI の削除系・本番ホストへの接続等）を追記する
5. `commitlint.config.js` を使うなら、`@commitlint/cli` と `@commitlint/config-conventional` を devDependencies に追加し、`commit-msg` フックから呼ぶ
6. `.github/workflows/` には「シークレットスキャン」と「ラベル同期」しか入っていない。ビルド・テストの CI はプロジェクト側で作る

`guard-git-write.sh` は配線していない。`git commit` / `git push` をラッパースクリプト経由まで含めて塞ぎたい場合のみ、`settings.json` の `PreToolUse` に追加するよう案内する。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- テンプレートに含まれないディレクトリを承認なしに作らない（README の本文を `docs/` 配下へ移す場合も、移動先を承認してもらってから作る）
- コピー結果をコミットしない（コミットは人が行う）

$ARGUMENTS

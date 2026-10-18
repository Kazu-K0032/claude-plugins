---
name: terraform
description: Terraform でインフラを管理するリポジトリに、infra/ 配下の構成（環境ごとのルートモジュール stg・prod と modules/）、置き場所・ファイルの分け方・変数・秘匿値・実行の手順をまとめた規約（.claude/rules/terraform.md）、Claude による apply・destroy・state の書き換えと -out の無い plan を止めるフック（.claude/hooks/guard-terraform.sh）を導入する。Terraform のプロジェクトを立ち上げる時、または既存の Terraform リポジトリへ規約とフックを後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象。例: 規約だけ / フックだけ / 既存は置き換えない）]"
---

# Terraform プロジェクトのセットアップ（terraform）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/`）を、実行中のリポジトリのルートへコピーし、フックを登録する。**既存ファイルは承認なしに上書きしない**。

- 外へ書き込むもの：導入先の `infra/`・`.claude/rules/terraform.md`・`.claude/hooks/guard-terraform.sh`。承認を得てから、`.claude/settings.json`（フックと deny）・`lefthook.yml`（古い形では `.claude/hooks/post-edit-lint.sh`）・`cspell.json` にも足す
- 人がすること：承認、`terraform` とクラウドの CLI の実行、コピー結果のコミット、`/project:init-repo` の実行

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` | 状態判定（NEW / SAME / DIFF）とコピーを実行するとき。project プラグインの全 Skill で共有するため、`--skill terraform` で対象を指定する |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/` | コピー元のテンプレート一式を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/.claude/rules/terraform.md` | 置き場所と実装の規約を確かめるとき。既存の構成に合わせて書き換える（手順 4）ときの元にもする |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/.claude/hooks/guard-terraform.sh` | Claude が実行してはいけない Terraform のコマンドを止める PreToolUse フックを確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/existing-files.md` | 既存の `.tf` がある（B の場合）、または `DIFF` のファイルがあるとき（手順 4・5） |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/settings-and-hooks.md` | `.claude/settings.json`・Lint のフック・`cspell.json` に足すとき（手順 6・7・8） |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/post-install.md` | コピーが終わったとき（手順 9） |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/README.md` | 収録物の一覧・除外したものとその理由を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | Markdown の書式を確かめるとき。読んで、その規約に従う |

## 想定している引数

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、`DIFF` は手順 5 で 1 件ずつ判断してもらう。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/terraform.md` だけ |
| `フックだけ` | `.claude/hooks/guard-terraform.sh` だけ（手順 6 の登録も対象） |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 5 を飛ばす |

範囲を絞った場合は、`--check` の結果から対象ファイルの相対パスを確定し、手順 3 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。

## 手順

### 1. 現状を確認する

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること

最初に、土台の `.claude/settings.json` があるかを Glob で確かめる。無ければ、`AskUserQuestion` で聞く。

| 選択肢 | 次の動き |
| --- | --- |
| 先に init-repo を実行する（推奨） | ここで止め、`/project:init-repo` を実行してから `/project:terraform` を呼び直すよう案内する。どちらも Claude からは呼べないため、利用者が実行する |
| このまま進める | 次の影響を伝えて続ける。フック（`guard-terraform.sh`）と秘匿ファイルの deny を登録できない。`lefthook.yml` も無ければ、`terraform fmt` をフックで動かせない |

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill terraform --check
```

ラベルの意味は次のとおり。

| ラベル | 意味 |
| --- | --- |
| `NEW` | 導入先に存在しない。コピー対象 |
| `SAME` | 既存ファイルと内容が一致。何もしない |
| `DIFF` | 既存ファイルと内容が異なる。**自動では触らない** |

あわせて、既存の Terraform を `**/*.tf` の Glob で探す。`.terraform/`・`node_modules/` は除く。結果から、次のどちらに当たるかを決める。

| 状態 | 扱い |
| --- | --- |
| A：`.tf` が無い | テンプレート全体を入れる |
| B：`.tf` がある | ファイルを動かさない。CI・手順書・手元の state が今のパスに依存しているため。`.claude/rules/terraform.md` と `.claude/hooks/guard-terraform.sh` だけをコピーし、手順 4 で規約を今の構成に合わせる。`infra/` の雛形は入れない |

あわせて、`.claude/settings.json`・`.claude/hooks/guard-destructive.sh`・`.claude/hooks/post-edit-lint.sh`・`lefthook.yml` があるかを確かめる。手順 6・7 で使う。

### 2. 導入計画を提示して承認を得る（必須）

`--check` の結果を、新規作成するファイル（`NEW`）・既存のまま残すファイル（`SAME`）・衝突していて判断が要るファイル（`DIFF`）に分けて提示する。あわせて、手順 1 の状態（A・B）と入れないファイル、手順 6 のフックと deny の登録、手順 7 で Lint のフックに `terraform fmt` を足すか、手順 8 でスペルチェックの除外語を足すかを示す。

テンプレートの中身を確かめられるよう、`https://github.com/Kazu-K0032/claude-plugins/tree/v<版>/plugins/project/skills/terraform/files` も示す。`<版>` は `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` の `version` にする。入れている版と同じ中身を見せるため。リリース前の版ではタグが無く、開けない。

### 3. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill terraform --apply
```

B の場合と、範囲を絞った場合は、入れる `NEW` のファイルを `--only` に列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill terraform --apply --only .claude/rules/terraform.md .claude/hooks/guard-terraform.sh
```

### 4. 今の構成に合わせる（B の場合）

コピーした `.claude/rules/terraform.md` を、`existing-files.md` の「今の構成に合わせる」に従って、今の構成の場所に書き換える。規約と違う点は一覧にし、`AskUserQuestion` で扱いを聞く。`.tf` は変えない。

### 5. 衝突したファイルを片付ける

`DIFF` のファイルがあれば、`existing-files.md` の「衝突したファイルを片付ける」に従って 1 件ずつ片付ける。

### 6. フックと deny を登録する

土台の `.claude/settings.json` があれば、`settings-and-hooks.md` の「フックと deny を登録する」に従い、無いものを足す案を差分で示し、承認を得てから足す。引数が `規約だけ` のときは飛ばす。

### 7. Lint のフックに terraform fmt を足す

`terraform fmt` を動かす定義が無ければ、`settings-and-hooks.md` の「Lint のフックに terraform fmt を足す」に従い、フックの形に合わせて足す案を差分で示し、承認を得てから足す。

### 8. スペルチェックの除外語を足す

`cspell.json` に足りない語があれば、`settings-and-hooks.md` の「スペルチェックの除外語を足す」に従い、足す案を示し、承認を得てから足す。

### 9. 導入後にやることを伝える

コピーが終わったら、`post-install.md` の項目を残作業としてユーザーに提示する。済んでいる項目は省く。最後に、手順 2 と同じテンプレートのリンクを添える。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存の `.tf`・state を移動・改名・変更しない
- `terraform`（`init`・`plan`・`apply` を含む）とクラウドの CLI を実行しない。認証情報・state・実際のインフラに触れるため、人が実行する
- コピー結果をコミットしない（コミットは人が行う）
- ファイルを消さない

$ARGUMENTS

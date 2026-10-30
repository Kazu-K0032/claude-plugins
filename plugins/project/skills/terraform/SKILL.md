---
name: terraform
description: Terraform でインフラを管理するリポジトリに、infra/ 配下の構成（環境ごとのルートモジュール stg・prod と modules/）、置き場所・ファイルの分け方・変数・秘匿値・実行の手順をまとめた規約（.claude/rules/terraform.md）、Claude による apply・destroy・state の書き換えと -out の無い plan を止めるフック（.claude/hooks/guard-terraform.sh）を導入する。Terraform のプロジェクトを立ち上げる時、または既存の Terraform リポジトリへ規約とフックを後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[--rules-only | --hooks-only（任意。省略時はテンプレート全体。付けると規約だけ・フックだけ）] [--keep-existing（任意。省略時は既存ファイルを 1 件ずつ聞く。付けると置き換えない）]"
---

# Terraform プロジェクトのセットアップ（terraform）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/`）を実行中のリポジトリのルートへコピーし、Claude が実行してはいけない Terraform のコマンドを止めるフックを登録する。**既存ファイルは承認なしに上書きしない**。

- 外へ書き込むもの：リポジトリのルートへのテンプレートのコピーと、承認を得た規約の書き換え・`.claude/settings.json`（フック・deny）・Lint のフック・`cspell.json` への追記
- 人がすること：導入計画と書き込みの承認、`DIFF` の扱いの選択、`terraform` とクラウドの CLI の実行、コミット、導入後の作業（手順 9）。フックは `bash` と `jq` を、導入後の実行は Terraform を使う

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/references/init-repo-first.md` | 手順 1 の最初 |
| `${CLAUDE_PLUGIN_ROOT}/references/install-flow.md` | 手順 1・2・3・5 |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/existing-layout.md` | 手順 4（状態 B） |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/merge-policy.md` | 手順 5 で `DIFF` のファイルがあるとき（選択肢を示す前から） |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/settings-additions.md` | 手順 6 |
| `${CLAUDE_PLUGIN_ROOT}/references/lint-hook-shapes.md` | 手順 7 で、フックの形を見分けるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/lint-hook.md` | 手順 7 で、足す定義を書くとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/after-install.md` | 手順 9 |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/.claude/rules/terraform.md` | 置き場所と実装の規約を確かめるとき。既存の構成に合わせて書き換えるときの元にもする |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/.claude/hooks/guard-terraform.sh` | Claude が実行してはいけない Terraform のコマンド（このフックが止めるもの）を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/README.md` | 収録物・除外したものを確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | Markdown を書く・直すとき。その規約に従う |

## 想定している引数

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、`DIFF` は手順 5 で 1 件ずつ判断してもらう。範囲を絞ったときは、手順 3 で `--only` に `NEW` のファイルだけを並べる。

| 引数 | 対象・扱い |
| --- | --- |
| `--rules-only`（「規約だけ」なども同じ） | `.claude/rules/terraform.md` だけ |
| `--hooks-only`（「フックだけ」なども同じ） | `.claude/hooks/guard-terraform.sh` だけ（手順 6 の登録も対象） |
| `--keep-existing`（「既存は置き換えない」なども同じ） | `DIFF` はすべて据え置き、手順 5 を飛ばす |

表に無い指定（入れないファイルなど）は補足として、手順 2 の導入計画に、どう読んだかを書く。知らない `--` のオプションは、推測せずに聞く。

## 手順

### 1. 現状を確かめる

`init-repo-first.md` で土台の有無を確かめ、`install-flow.md` の「状態を確かめる」に従って `--skill terraform --check` を実行する。あわせて、既存の Terraform を `**/*.tf` の Glob で探し（`.terraform/`・`node_modules/` は除く）、次のどちらに当たるかを決める。

| 状態 | 扱い |
| --- | --- |
| A：`.tf` が無い | テンプレート全体を入れる |
| B：`.tf` がある | ファイルを動かさない。CI・手順書・手元の state が今のパスに依存しているため。`.claude/rules/terraform.md` と `.claude/hooks/guard-terraform.sh` だけをコピーし、手順 4 で規約を今の構成に合わせる。`infra/` の雛形は入れない |

あわせて、手順 6・7 で使う `.claude/settings.json`・`.claude/hooks/guard-destructive.sh`・`.claude/hooks/post-edit-lint.sh`・`lefthook.yml` があるかを確かめる。

### 2. 導入計画を示して承認を得る（必須）

`install-flow.md` の「導入計画を示す」に従って示し、承認を得る。あわせて、手順 1 の状態（A・B）と入れないファイル、手順 6 のフックと deny の登録、手順 7 で Lint のフックに `terraform fmt` を足すか、手順 8 でスペルチェックの除外語を足すかを示す。

### 3. コピーする

`install-flow.md` の「コピーする」に従う。B の場合（`--only .claude/rules/terraform.md .claude/hooks/guard-terraform.sh`）と、範囲を絞った場合は、入れる `NEW` のファイルを `--only` に並べる。

### 4. 今の構成に合わせる（B の場合）

`existing-layout.md` に従い、コピーした規約のパスを今の構成に書き換え、規約と違う点の扱いを聞く。`.tf` は変えない。

### 5. 衝突したファイルを片付ける

`install-flow.md` の「衝突したファイルを片付ける」に従い、マージは `merge-policy.md` の方針で行う。

### 6. フックと deny を登録する

`settings-additions.md` に従い、`.claude/settings.json` にフック（`guard-terraform.sh`）と秘匿ファイルの deny を足す案を差分で示し、承認を得てから足す。引数が `--rules-only` のときは飛ばす。

### 7. Lint のフックに terraform fmt を足す

`terraform fmt` を動かす定義が無ければ、`lint-hook-shapes.md` でフックの形を見分け、`lint-hook.md` の定義を足す案を差分で示し、承認を得てから足す。`.tfvars` は、秘匿値を含むことがあり差分が Claude に渡るため、対象にしない。

### 8. スペルチェックの除外語を足す

`cspell.json` があり、テンプレートと手順 6 の deny が使う語（`chdir`・`templatefile`・`tfstate`・`tftpl`・`tfvars`・`untaint`）が `words` に無ければ、足す案を示し、承認を得てから足す。足さないと、`init-repo` の `pr-checks.yml` のスペルチェックで誤字として出るため。

### 9. 導入後にやることを伝える

`after-install.md` の残作業を示す。最後に、手順 2 と同じテンプレートのリンクを添える。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存の `.tf`・state を移動・改名・変更しない
- `terraform`（`init`・`plan`・`apply` を含む）とクラウドの CLI を実行しない。認証情報・state・実際のインフラに触れるため、人が実行する
- コピー結果をコミットしない（コミットは人が行う）
- ファイルを消さない

$ARGUMENTS

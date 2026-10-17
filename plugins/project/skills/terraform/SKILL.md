---
name: terraform
description: Terraform でインフラを管理するリポジトリに、infra/ 配下の構成（環境ごとのルートモジュール stg・prod と modules/）、置き場所・ファイルの分け方・変数・秘匿値・実行の手順をまとめた規約（.claude/rules/terraform.md）、Claude による apply・destroy・state の書き換えと -out の無い plan を止めるフック（.claude/hooks/guard-terraform.sh）を導入する。Terraform のプロジェクトを立ち上げる時、または既存の Terraform リポジトリへ規約とフックを後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象。例: 規約だけ / フックだけ / 既存は置き換えない）]"
---

# Terraform プロジェクトのセットアップ（terraform）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/`）を、実行中のリポジトリのルートへコピーし、フックを登録する。**既存ファイルは承認なしに上書きしない**。

Markdown の書式は `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` を Read し、その規約に従う。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` | 状態判定（NEW / SAME / DIFF）とコピーの実行。project プラグインの全 Skill で共有するため、`--skill terraform` で対象を指定する |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/` | コピー元のテンプレート一式 |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/.claude/rules/terraform.md` | 置き場所と実装の規約（既存の構成に合わせて書き換えるときの元にもする） |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/.claude/hooks/guard-terraform.sh` | Claude が実行してはいけない Terraform のコマンドを止める PreToolUse フック |
| `${CLAUDE_PLUGIN_ROOT}/skills/terraform/README.md` | 収録物の一覧・除外したものとその理由 |

## 前提条件

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること
- フックは `bash` と [`jq`](https://jqlang.org/) を使う。導入後の実行には Terraform が要る（このスキル自体はどちらも使わない）
- `.claude/settings.json`・`CLAUDE.md` などの土台（`/project:init-repo`）は必須ではない。無ければ手順 1 で、先に入れるかを聞く。土台の `.claude/settings.json` があれば手順 6 でフックと deny を登録し、`lefthook.yml`（古い形では `.claude/hooks/post-edit-lint.sh`）があれば手順 7 で `terraform fmt` を足す

## 引数の解釈

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、`DIFF` は手順 5 で 1 件ずつ判断してもらう。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/terraform.md` だけ |
| `フックだけ` | `.claude/hooks/guard-terraform.sh` だけ（手順 6 の登録も対象） |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 5 を飛ばす |

範囲を絞った場合は、`--check` の結果から対象ファイルの相対パスを確定し、手順 3 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。

## 手順

### 1. 現状を確認する

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

コピーした `.claude/rules/terraform.md` の、frontmatter の `paths`、冒頭の固有の値の表、「置き場所」の表と、`infra/` で始まるパスを、今の構成の場所に書き換える。

今の構成が規約と違う点（workspace で環境を分けている・ファイルの分け方が違うなど）は一覧にし、`AskUserQuestion` で扱いを聞く。`.tf` は変えない。

| 選択肢 | 扱い |
| --- | --- |
| 規約を今の構成に合わせる | 規約の該当の行を、今の構成の書き方に書き換える |
| 規約のまま残す | 規約は変えず、構成を直すかは手順 9 で利用者に任せる |

### 5. 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/<同じ相対パス>"
```

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `.claude/rules/terraform.md` | 既存の規約に足りない項目だけを足す |
| `.claude/hooks/guard-terraform.sh` | 既存を正とする。止めるコマンドが足りなければ、`deny_patterns` に足すことを提案する |
| `infra/.gitignore` | 足りない行だけを足す |
| `infra/README.md`・`infra/modules/README.md` | 既存の一覧に、足したファイルの行だけを足す |
| `infra/environments/` の `.tf`・`terraform.tfvars.example` | 上書きしない |

### 6. フックと deny を登録する

`.claude/settings.json` に、次のうち無いものを足す案を差分で示し、承認を得てから足す。ほかのキーと書式は変えない。引数が `規約だけ` のときは飛ばす。

- フック：この実行で `.claude/hooks/guard-terraform.sh` を入れ、`guard-terraform.sh` の行が無いとき。`hooks.PreToolUse` の `"matcher": "Bash"` の `hooks` に次を足す。`"matcher": "Bash"` の定義が無ければ、`PreToolUse` に定義ごと足す

    ```json
    {
      "type": "command",
      "command": "bash .claude/hooks/guard-terraform.sh"
    }
    ```

- deny：`permissions.deny` に、次のうち無い行を足す。変数の値・state・`.terraform/` は秘匿値を平文で含むため、Claude に読ませない

    ```json
    [
      "Read(./**/*.tfvars)",
      "Read(./**/*.tfvars.json)",
      "Read(./**/*.tfstate)",
      "Read(./**/*.tfstate.*)",
      "Read(./**/.terraform/**)"
    ]
    ```

`.claude/settings.json` が無い場合は作らない。あとで `/project:init-repo` を入れると衝突するため。手順 9 で、上の定義と `/project:init-repo` を伝える。

`.claude/hooks/guard-destructive.sh` に、`terraform plan` の `-out` を確かめるブロックや、`patterns` の Terraform の行（古い `init-repo` の形）があれば、変えない。手順 9 で、`guard-terraform.sh` と重なることを伝える。

### 7. Lint のフックに terraform fmt を足す

`terraform fmt` を動かす定義が無ければ、フックの形に合わせて足す案を差分で示し、承認を得てから足す。`.tfvars` を対象にしないのは、秘匿値を含むことがあり、差分が Claude に渡るため。

| フックの形 | 足すもの・場所 |
| --- | --- |
| `post-edit-lint.sh` が `lefthook run claude-edit` を呼ぶ（今の `init-repo` の形） | lefthook の設定（`lefthook.yml`・`.lefthook.yml` など）の `claude-edit` の `commands` に、下の YAML を足す。`claude-edit` が無ければ、`piped: true` と一緒に定義ごと足す |
| `post-edit-lint.sh` に `[ -d "$LINT_DIR/node_modules/.bin" ] \|\| finish` の行がある（古い `init-repo` の形） | 下の bash のブロックを、その行より前に足す。後ろに足すと、Node を使わないリポジトリでブロックまで届かないため |
| 上の行が無く、`post-edit-lint.sh` に `# --- 言語別チェック` の区切りがある | 下の bash のブロックを、区切りのすぐ後ろに足す |
| `report`・`finish` を使っていない（`init-repo` 以外の形） | 書き換えず、下の bash のブロックを示して、利用者に足し方を決めてもらう |

フックが古い形のまま `lefthook.yml` もある（`init-repo` を入れ直し、フックを据え置いた）ときは、`lefthook.yml` に足しても動かない。`AskUserQuestion` で、次のどちらにするかを聞く。

| 選択肢 | 扱い |
| --- | --- |
| `lefthook.yml` に足す（推奨） | 下の YAML を足す。フックを今の形にするため、手順 9 で `/project:init-repo` を実行し、`post-edit-lint.sh` を上書きするよう伝える |
| 古い形のフックに足す | 下の bash のブロックを、上の表の古い形の行に従って足す |

`lefthook.yml` に足す定義。整形はファイルを書き換える。`*.tf` は `.tfvars` に一致しない。

```yaml
terraform-fmt:
  priority: 1
  glob: "*.tf"
  run: 'command -v terraform >/dev/null 2>&1 || exit 0; terraform fmt {staged_files}'
```

古い形の `post-edit-lint.sh` に足すブロック（整形は確かめるだけ）。

```bash
# Terraform: terraform fmt（整形の確認）
# .tfvars は秘匿値を含むことがあり、差分が Claude に渡るため検査しない
case "$file_path" in
  *.tf)
    if command -v terraform >/dev/null 2>&1; then
      result=$(terraform fmt -check -diff "$file_path" 2>&1 || true)
      if [ -n "$result" ]; then
        report+="⚠️  terraform fmt: $file_path"$'\n'"$result"$'\n'
      fi
    fi
    finish
    ;;
esac
```

`lefthook.yml`・`post-edit-lint.sh` が無い場合は、手順 9 で、`/project:init-repo` で入れられることを伝える。

### 8. スペルチェックの除外語を足す

`cspell.json` があり、テンプレートと手順 6 の deny が使う語（`chdir`・`templatefile`・`tfstate`・`tftpl`・`tfvars`・`untaint`）が `words` に無ければ、足す案を示し、承認を得てから足す。足さないと、`init-repo` の `pr-checks.yml` のスペルチェックで誤字として出るため。

### 9. 導入後にやることを伝える

コピーが終わったら、次を残作業としてユーザーに提示する。済んでいる項目は省く。コマンドは人が実行する。最後に、手順 2 と同じテンプレートのリンクを添える。

1. 各環境の `terraform.tf`・`backend.tf`・`providers.tf` の `TODO:` に、使うクラウドのプロバイダと backend を書く。backend を書くまでは apply しない。state が手元にでき、共有できないため
1. 各環境のディレクトリで `terraform init` を実行し、できた `.terraform.lock.hcl` をコミットする
1. 反映するときは、`terraform plan -out=tfplan` の結果を確かめてから、`terraform apply tfplan` を実行する
1. `CLAUDE.md` があれば、「ディレクトリ」に `infra/` を足す。ルートの `README.md` から `infra/README.md` へ案内する
1. 手順 6 でフックと deny を登録しなかった場合は、`.claude/settings.json` に手順 6 の定義を足す（`/project:init-repo` で土台を入れてからでもよい）
1. 手順 6 で `guard-destructive.sh` に古い Terraform のブロックや `patterns` の行が見つかった場合は、`guard-terraform.sh` と重なるため、消してよい
1. 手順 7 でフックに足さなかった場合は、`terraform fmt` をフックで動かすかを決める
1. 手順 7 で、古い形のフックのまま `lefthook.yml` に足した場合は、`/project:init-repo` を実行して `post-edit-lint.sh` を上書きする。上書きするまで、足した定義は動かない
1. 手順 4 で規約のまま残した違いがあれば、構成を直すかを決める

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存の `.tf`・state を移動・改名・変更しない
- `terraform`（`init`・`plan`・`apply` を含む）とクラウドの CLI を実行しない。認証情報・state・実際のインフラに触れるため、人が実行する
- コピー結果をコミットしない（コミットは人が行う）
- ファイルを消さない

$ARGUMENTS

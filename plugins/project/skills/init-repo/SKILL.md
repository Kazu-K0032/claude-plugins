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

- 外へ書き込むもの：導入先のリポジトリのファイル（テンプレートのコピー・承認を得たマージ・README の本文の移動先）
- 人がすること：導入計画と各提案の承認、衝突したファイルの扱いの選択、ツールの導入、コミット

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` | 手順 1・3 で、状態判定（NEW / SAME / DIFF）とコピーを実行するとき。project プラグインの全 Skill で共有するため、`--skill init-repo` で対象を指定する |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/files/` | 手順 4 で、`DIFF` の差分を見せるとき。コピー元のテンプレート一式 |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/README.md` | 収録物・除外したものとその理由・導入後の調整項目を確かめるとき。手順 6 で、lefthook の最低の版を伝えるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/scope.md` | 手順 2 で、計画を作るとき。引数の細部・要否の判定・依存関係・計画から外す条件 |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/existing-files.md` | 手順 4 で、`DIFF` を片付けるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/tooling.md` | 手順 5 で、拡張機能・Lint と整形のツール・除外語を提案するとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/init-repo/after-copy.md` | 手順 6・7 で、残作業と続けて使うスキルを伝えるとき |

## 想定している引数

引数は「どのファイルを入れるか」の指定として読む。省略時はテンプレート全体が対象。指定は次の 3 種類を組み合わせられる（例：`必要なものだけ・既存は置き換えない`）。

- **範囲の指定**：どのファイルを候補にするか（パス指定・必要性の判定・要件からの逆算）
- **既存物の扱い**：既にあるものをどうするか
- **ツールの指定**：Lint・整形に使うツール（例：`整形は oxfmt`）。手順 5 で使う

迷う指定は、対象ファイルの一覧を見せて確認する。指定があるときは、`scope.md` の「範囲の指定」「既存物の扱い」を読む。

## 手順

### 1. 現状を確認する

次の前提のもとで、テンプレートの各ファイルが導入先でどういう状態かを `--check` で確かめる。

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること
- 導入するフックは実行時に [`jq`](https://jqlang.org/) を使う。未インストールの環境ではフックが失敗する
- 編集後の Lint・整形は [lefthook](https://lefthook.dev/) で動かす。最低の版は README.md の「前提と制約」にある。未インストールの環境では、フックは何もしない

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

`scope.md` の「計画に載せる内容と、入れないテンプレート」に従い、`--check` の結果を、次の 3 つに分けてユーザーへ提示する。

- これから新規作成するファイル（`NEW`）
- 既存のまま残すファイル（`SAME`）
- 衝突していて判断が要るファイル（`DIFF`）

`CLAUDE.md` / `README.md` が既にあるリポジトリでは、ほぼ確実に `DIFF` になる。**テンプレートで上書きすると既存の記述が失われる**ことを明示したうえで承認を求める。

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

`CLAUDE.md` と設定ファイルのマージ方針、README の本文の移し方は、`existing-files.md` を読む。`既存は置き換えない` のときも、既存の `CLAUDE.md` の `docs-type` の節を外す提案は、そこに従って行う。

### 5. エディタ設定・Lint と整形のツール・スペルチェックの除外語を調整する

`.vscode/`・`cspell.json`・`lefthook.yml` を導入した（または既にある）場合は、プロジェクトに合わせて中身を提案する。どれも**一覧を見せて承認を得てから**書き込む。決め方は `tooling.md` を読む。

### 6. 導入後にやることを伝える

コピーが終わったら、`after-copy.md` の「導入後にやること」を残作業としてユーザーに提示する。lefthook を入れる項目には、最低の版を添える。最後に、手順 2 と同じテンプレートのリンクを添える。

### 7. 続けて使うスキルを聞く

引数がパス指定（`.github だけ` など）のときは聞かずに終える。それ以外は、`after-copy.md` の「続けて使うスキルの聞き方」に従い、続けて使う技術スタック別のスキルを聞く。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- テンプレートに含まれないディレクトリを承認なしに作らない（README の本文を `docs/` 配下へ移す場合も、移動先を承認してもらってから作る）
- コピー結果をコミットしない（コミットは人が行う）

## 保守

- lefthook の最低の版は、README.md の「前提と制約」だけに書く。ほかの文書には書かず、README を指す
- cspell の版は、`files/.github/workflows/pr-checks.yml` と `tooling.md` のコマンドの 2 か所に書く。コマンドに版が要るため、上げるときは両方をそろえる

$ARGUMENTS

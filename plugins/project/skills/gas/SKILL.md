---
name: gas
description: Google Apps Script（GAS）のリポジトリに、clasp で push する src/ 配下の構成と .clasp.json、ファイルの書き分けと GAS 特有の注意点をまとめた規約（.claude/rules/gas.md・gas-runtime.md）を導入する。GAS のプロジェクトを立ち上げる時、または既存の GAS リポジトリへ構成と規約を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象。例: 規約だけ / src だけ / 既存は置き換えない）]"
---

# GAS プロジェクトのセットアップ（gas）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/gas/files/`）を、実行中のリポジトリのルートへコピーする。**既存ファイルは承認なしに上書きしない**。

- 外へ書き込むもの：導入先の `src/`・`.clasp.json`・`.claude/rules/gas.md`・`.claude/rules/gas-runtime.md`。承認を得てから、既存コードの `src/` への移動（`git mv`）と、`.gitignore` への追記も行う
- 人がすること：承認、`clasp` の実行（`push`・`pull`・`login`）、コピー結果のコミット、`/project:init-repo` の実行

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` | 状態判定（NEW / SAME / DIFF）とコピーを実行するとき。project プラグインの全 Skill で共有するため、`--skill gas` で対象を指定する |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/files/` | コピー元のテンプレート一式を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/files/.claude/rules/gas.md`・`gas-runtime.md` | 規約の中身を確かめるとき。既存コードの振り分けの基準にもする（`gas.md` はファイルの書き分け・関数の命名・clasp の運用、`gas-runtime.md` は実行時間・トリガー・秘匿値） |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/existing-code.md` | 既存の GAS コードがあるとき（手順 1 の方針、手順 3 の移動、手順 6 の振り分け） |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/conflicts.md` | `DIFF` のファイルがあるとき（手順 5） |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/post-install.md` | コピーが終わったとき（手順 8） |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/README.md` | 収録物の一覧・除外したものとその理由を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | Markdown の書式を確かめるとき。読んで、その規約に従う |

## 想定している引数

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、`DIFF` は手順 5 で 1 件ずつ判断してもらう。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/gas.md`・`.claude/rules/gas-runtime.md` だけ |
| `src だけ` | `src/` 配下だけ |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 5 を飛ばす |

範囲を絞った場合は、`--check` の結果から対象ファイルの相対パスを確定し、手順 4 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。

## 手順

### 1. 現状を確認する

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること

最初に、土台の `.claude/settings.json` があるかを Glob で確かめる。無ければ、`AskUserQuestion` で聞く。

| 選択肢 | 次の動き |
| --- | --- |
| 先に init-repo を実行する（推奨） | ここで止め、`/project:init-repo` を実行してから `/project:gas` を呼び直すよう案内する。どちらも Claude からは呼べないため、利用者が実行する |
| このまま進める | 次の影響を伝えて続ける。このスキルの動きは変わらないが、秘匿ファイルの deny・破壊的な操作を止めるフック・`CLAUDE.md` などの土台は入らない |

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill gas --check
```

ラベルの意味は次のとおり。

| ラベル | 意味 |
| --- | --- |
| `NEW` | 導入先に存在しない。コピー対象 |
| `SAME` | 既存ファイルと内容が一致。何もしない |
| `DIFF` | 既存ファイルと内容が異なる。**自動では触らない** |

あわせて、既存の GAS コードを Glob で探す（`**/*.gs`・`**/*.js`・`**/*.html`・`**/appsscript.json`・`.clasp.json`。`node_modules/` は除く）。既存のコードがあり、`.clasp.json` の `rootDir` が `src` 以外の場合は、`existing-code.md` の「方針を決める」に従い、方針 A・B をユーザーに選んでもらう。

### 2. 導入計画を提示して承認を得る（必須）

`--check` の結果を、新規作成するファイル（`NEW`）・既存のまま残すファイル（`SAME`）・衝突していて判断が要るファイル（`DIFF`）に分けて提示する。既存の GAS コードがある場合は、手順 1 で選んでもらった方針と、手順 6 で振り分けを行うことも併せて示す。方針 A では、移すファイルの一覧も示す。

テンプレートの中身を確かめられるよう、`https://github.com/Kazu-K0032/claude-plugins/tree/v<版>/plugins/project/skills/gas/files` も示す。`<版>` は `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` の `version` にする。入れている版と同じ中身を見せるため。リリース前の版ではタグが無く、開けない。

`.clasp.json` に `scriptId` が入っている（既存の Apps Script プロジェクトにつながっている）場合は、承認を求める前に、手元のコードがスクリプトエディタ側と揃っているかをユーザーに確認する。エディタで直接直した内容が手元に無いまま構成を変えて `clasp push` すると、エディタ側の変更が消えるため。揃っているか分からない場合は、`clasp pull` で取り込んでもらってから手順 1 をやり直す（このスキルは clasp を実行しないため、ユーザーが行う）。

### 3. 既存コードを `src/` へ移す（方針 A の場合）

テンプレートをコピーする**前に**移す。先にコピーすると、テンプレートの `src/constants.js`・`src/utils.js` などが新しく作られ、同じ名前の既存ファイルを移せなくなるため。手順は `existing-code.md` の「方針 A の場合」に従う。

方針 B の場合はこの手順を飛ばし、`existing-code.md` の「方針 B の場合」に従って手順 4 のコピーの対象を絞る。

### 4. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill gas --apply
```

対象を絞る場合、または `DIFF` のファイルを上書きする場合は `--only` に相対パスを列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill gas --apply --only .claude/rules/gas.md .claude/rules/gas-runtime.md
```

### 5. 衝突したファイルを片付ける

`DIFF` のファイルがあれば、`conflicts.md` に従って 1 件ずつ片付ける。

### 6. 既存コードを振り分ける（既存の GAS コードがある場合）

`existing-code.md` の「既存コードを振り分ける」に従い、関数・定数ごとの移動先を表で提示し、承認を得てから移す。外から名前で呼ばれている関数は、名前を変えない。

### 7. `.gitignore` を整える

次の行が `.gitignore` に無ければ、追記を提案する（`.gitignore` が無ければ作成を提案する）。

| 行 | 理由 |
| --- | --- |
| `.clasprc.json` | `clasp login --creds` を使うと、認証情報が作業ディレクトリに保存されるため |

`.clasp.json` は除外しない。`scriptId` は秘匿値ではなく、リポジトリを clone してすぐ push できるようにするためコミットする。

### 8. 導入後にやることを伝える

コピーが終わったら、`post-install.md` の項目を残作業としてユーザーに提示する。既存のプロジェクトで済んでいる項目は省く。最後に、手順 2 と同じテンプレートのリンクを添える。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存の関数を承認なしに移動・改名しない。`existing-code.md` の「既存コードを振り分ける」で「名前を変えない」とした関数は、承認があっても改名を提案しない
- `clasp push` / `clasp pull` / `clasp login` など、リモートへの反映や認証を伴うコマンドを実行しない（人が実行する）
- コピー結果をコミットしない（コミットは人が行う）

$ARGUMENTS

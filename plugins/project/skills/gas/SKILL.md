---
name: gas
description: Google Apps Script（GAS）のリポジトリに、clasp で push する src/ 配下の構成と .clasp.json、ファイルの書き分けと GAS 特有の注意点をまとめた規約（.claude/rules/gas.md・gas-runtime.md）を導入する。GAS のプロジェクトを立ち上げる時、または既存の GAS リポジトリへ構成と規約を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象。例: 規約だけ / src だけ / 既存は置き換えない）]"
---

# GAS プロジェクトのセットアップ（gas）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/gas/files/`）を実行中のリポジトリのルートへコピーし、既存の GAS コードがあれば規約に沿った振り分けを提案する。**既存ファイルは承認なしに上書きしない**。

- 外へ書き込むもの：リポジトリのルートへのテンプレートのコピーと、承認を得た既存コードの移動・振り分け、`.clasp.json`・`.gitignore`・`.claspignore` の変更
- 人がすること：導入計画と書き込みの承認、`DIFF` の扱いの選択、clasp の実行（`login`・`pull`・`push`。push には Node.js と clasp が要る）、コミット、導入後の作業（手順 8）

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/references/init-repo-first.md` | 手順 1 の最初 |
| `${CLAUDE_PLUGIN_ROOT}/references/install-flow.md` | 手順 1・2・4・5 |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/existing-layout.md` | 既存のコードがあり、`rootDir` が `src` 以外のとき（手順 1・3・4） |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/merge-policy.md` | 手順 5 で `DIFF` のファイルがあるとき（選択肢を示す前から）・導入済みの `gas.md` が 1 ファイル版のとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/existing-code.md` | 手順 6 |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/files/.claude/rules/gas.md` | 手順 6 で、振り分けの基準（ファイルの書き分け・関数の命名）を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/after-install.md` | 手順 8 |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/README.md` | 収録物・除外したものを確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | Markdown を書く・直すとき。その規約に従う |

## 想定している引数

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、`DIFF` は手順 5 で 1 件ずつ判断してもらう。範囲を絞ったときは、手順 4 で `--only` に `NEW` のファイルだけを並べる。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/gas.md`・`.claude/rules/gas-runtime.md` だけ |
| `src だけ` | `src/` 配下だけ |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 5 の衝突の片付けを飛ばす。古い 1 ファイル版の規約の片付けは行う |

## 手順

### 1. 現状を確かめる

`init-repo-first.md` で土台の有無を確かめ、`install-flow.md` の「状態を確かめる」に従って `--skill gas --check` を実行する。あわせて、既存の GAS コードを Glob で探す（`**/*.gs`・`**/*.js`・`**/*.html`・`**/appsscript.json`・`.clasp.json`。`node_modules/` は除く）。

既存のコードがあり、`.clasp.json` の `rootDir` が `src` 以外（未指定・絶対パスを含む）なら、`existing-layout.md` の方針 A・B から選んでもらう。決めずにコピーすると、既存のコードと別の場所（`src/`）にテンプレートのコードができてしまうため。

### 2. 導入計画を示して承認を得る（必須）

`install-flow.md` の「導入計画を示す」に従って示し、承認を得る。既存の GAS コードがあれば、手順 1 の方針と、手順 6 で振り分けることも示す。方針 A では、移すファイルの一覧も示す。

`.clasp.json` に `scriptId` が入っている（既存の Apps Script プロジェクトにつながっている）場合は、承認を求める前に、手元のコードがスクリプトエディタ側とそろっているかを利用者に確かめる。エディタで直した内容が手元に無いまま構成を変えて `clasp push` すると、エディタ側の変更が消えるため。分からなければ、`clasp pull` で取り込んでもらってから手順 1 をやり直す（このスキルは clasp を実行しない）。

### 3. 既存コードを `src/` へ移す（方針 A の場合）

テンプレートをコピーする**前に**、`existing-layout.md` の「方針 A」に従って移す。方針 B の場合は、この手順を飛ばす。

### 4. コピーする

`install-flow.md` の「コピーする」に従う。方針 B では規約だけをコピーし、`existing-layout.md` の「方針 B」に従って `paths` を今の `rootDir` に合わせる。

### 5. 衝突したファイルを片付ける

`install-flow.md` の「衝突したファイルを片付ける」に従い、マージは `merge-policy.md` の方針で行う。導入済みの `.claude/rules/gas.md` が 1 ファイル版なら、`merge-policy.md` の「古い 1 ファイル版の片付け」にも従う（`既存は置き換えない` のときも）。

### 6. 既存コードを振り分ける（既存の GAS コードがある場合）

`existing-code.md` に従い、関数・定数ごとの移動先を表で示し、承認を得てから移す。トリガー・メニュー・HTML などから名前で呼ばれる関数は、名前を変えない。

### 7. `.gitignore` を整える

`.clasprc.json` が `.gitignore` に無ければ、追記を提案する（`.gitignore` が無ければ作成を提案する）。`clasp login --creds` を使うと、認証情報が作業ディレクトリに保存されるため。

`.clasp.json` は除外しない。`scriptId` は秘匿値ではなく、リポジトリを clone してすぐ push できるようにするためコミットする。

### 8. 導入後にやることを伝える

`after-install.md` の残作業を示す。最後に、手順 2 と同じテンプレートのリンクを添える。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存の関数を承認なしに移動・改名しない。`existing-code.md` の「名前を変えない関数」は、承認があっても改名を提案しない
- `clasp push` / `clasp pull` / `clasp login` など、リモートへの反映や認証を伴うコマンドを実行しない（人が実行する）
- コピー結果をコミットしない（コミットは人が行う）

$ARGUMENTS

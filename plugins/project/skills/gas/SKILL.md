---
name: gas
description: Google Apps Script（GAS）のリポジトリに、clasp で push する src/ 配下の構成（constants.js・main.js・utils.js・trigger.js・appsscript.json）と .clasp.json、ファイルの書き分けと GAS 特有の注意点をまとめた規約（.claude/rules/gas.md）を導入する。GAS のプロジェクトを立ち上げる時、または既存の GAS リポジトリへ構成と規約を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[例: 規約だけ / src だけ / 既存は置き換えない]"
---

# GAS プロジェクトのセットアップ（gas）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/gas/files/`）を、実行中のリポジトリのルートへコピーする。**既存ファイルは承認なしに上書きしない**。

Markdown の書式は `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` を Read し、その規約に従う。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` | 状態判定（NEW / SAME / DIFF）とコピーの実行。project プラグインの全 Skill で共有するため、`--skill gas` で対象を指定する |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/files/` | コピー元のテンプレート一式 |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/files/.claude/rules/gas.md` | ファイルの書き分け・関数の命名・GAS 特有の注意点（既存コードの振り分けの基準にも使う） |
| `${CLAUDE_PLUGIN_ROOT}/skills/gas/README.md` | 収録物の一覧・除外したものとその理由 |

## 前提条件

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること
- 導入後の push には Node.js と [clasp](https://github.com/google/clasp) が要る（このスキル自体は clasp を使わない）
- `.claude/settings.json`・`CLAUDE.md` などの土台も要るなら、先に `/project:init-repo` を実行しておく（必須ではない）

## 引数の解釈

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、`DIFF` は手順 4 で 1 件ずつ判断してもらう。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/gas.md` だけ |
| `src だけ` | `src/` 配下だけ |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 4 を飛ばす |

範囲を絞った場合は、手順 1 の `--check` 結果から対象ファイルの相対パスを確定し、手順 3 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。

## 手順

### 1. 現状を確認する

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill gas --check
```

ラベルの意味は次のとおり。

| ラベル | 意味 |
| --- | --- |
| `NEW` | 導入先に存在しない。コピー対象 |
| `SAME` | 既存ファイルと内容が一致。何もしない |
| `DIFF` | 既存ファイルと内容が異なる。**自動では触らない** |

あわせて、既存の GAS コードを Glob で探す（`**/*.gs`・`**/*.js`・`**/appsscript.json`・`.clasp.json`。`node_modules/` は除く）。見つかった場合は次を確認する。

- 既存の `.clasp.json` の `rootDir` が `src` 以外（未指定を含む）か。その場合は「既存コードを `src/` へ移してテンプレートに合わせる」か「既存の `rootDir` を残し、`gas.md` の `paths` をそのディレクトリに書き換える」かをユーザーに選んでもらう
- テンプレートの 4 ファイル以外のコード（例：`コード.gs`・`Code.js`）があるか。ある場合は手順 5 で振り分ける

### 2. 導入計画を提示して承認を得る（必須）

`--check` の結果を、新規作成するファイル（`NEW`）・既存のまま残すファイル（`SAME`）・衝突していて判断が要るファイル（`DIFF`）に分けて提示する。既存の GAS コードがある場合は、手順 1 で確認したことと、手順 5 で振り分けを行うことも併せて示す。

### 3. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill gas --apply
```

対象を絞る場合、または `DIFF` のファイルを上書きする場合は `--only` に相対パスを列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill gas --apply --only .claude/rules/gas.md
```

### 4. 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/gas/files/<同じ相対パス>"
```

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `src/appsscript.json` | 既存を正とする。`oauthScopes`・`dependencies`・`webapp` などの既存のキーは消さない。`timeZone`・`runtimeVersion` が違う場合は、変えるかを確認するだけにする |
| `.clasp.json` | 既存の `scriptId` は残す。`rootDir` は手順 1 で選んでもらった方針に従う |
| `src/*.js` | 既存のコードを捨てない。上書きせず、手順 5 の振り分けで扱う |
| `.claude/rules/gas.md` | 既存の規約に足りない項目だけを足す |

### 5. 既存コードを振り分ける（既存の GAS コードがある場合）

`gas.md` の「ファイルの書き分け」と「関数の命名」を基準に、既存コードの関数・定数ごとに移動先を表で提示する。

| 列 | 内容 |
| --- | --- |
| 関数・定数 | 名前と現在のファイル |
| 移動先 | `constants.js`・`main.js`・`utils.js`・`trigger.js`・役割ごとのファイル（例：`sheet.js`） |
| 名前の変更 | 末尾に `_` を付けるか（内部の処理だけ） |

次の関数は外から名前で呼ばれているため、**名前を変えない**。名前を変えるとトリガーや呼び出し元が動かなくなる。

- トリガーに登録されている関数（`ScriptApp.newTrigger('<関数名>')` の引数、またはエディタで手動登録したもの）
- HTML から `google.script.run` で呼ばれている関数
- `onOpen`・`onEdit`・`doGet`・`doPost` などの予約された名前の関数
- ライブラリとして他のプロジェクトから呼ばれている関数

承認を得てから移す。移した後、テンプレートの雛形（`main` の `TODO`・`onDailySchedule` 等）が既存の処理と重複する場合は、残すか消すかを確認する。

### 6. `.gitignore` を整える

次の行が `.gitignore` に無ければ、追記を提案する（`.gitignore` が無ければ作成を提案する）。

| 行 | 理由 |
| --- | --- |
| `.clasprc.json` | `clasp login --creds` を使うと、認証情報が作業ディレクトリに保存されるため |

`.clasp.json` は除外しない。`scriptId` は秘匿値ではなく、リポジトリを clone してすぐ push できるようにするためコミットする。

### 7. 導入後にやることを伝える

コピーが終わったら、次を残作業としてユーザーに提示する。

1. clasp を入れてログインする（`npm install -g @google/clasp` → `clasp login`）。初回は [Apps Script のユーザー設定](https://script.google.com/home/usersettings) で Google Apps Script API を有効にする
1. Apps Script のプロジェクトを用意し、エディタの「プロジェクトの設定」にあるスクリプト ID を `.clasp.json` の `scriptId` に書き込む
1. 既にコードがあるプロジェクトにつなぐ場合は、push の前に `clasp pull` で取り込み、手順 5 の振り分けを行う。pull するとリモートと同じ名前のローカルファイルはリモートの内容で上書きされる
1. `src/constants.js` の `TODO:` を埋める。秘匿値はエディタの「プロジェクトの設定」→「スクリプト プロパティ」に登録し、キー名を `PROPERTY_KEYS` に書く
1. `clasp push` で反映し、定期実行を使う場合はエディタから `setupTriggers` を 1 回実行する（初回は権限の承認を求められる）。定期実行を使わない場合は `trigger.js` の雛形を消す

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存の関数を承認なしに移動・改名しない。上記「名前を変えない」関数は承認があっても改名を提案しない
- `clasp push` / `clasp pull` / `clasp login` など、リモートへの反映や認証を伴うコマンドを実行しない（人が実行する）
- コピー結果をコミットしない（コミットは人が行う）

$ARGUMENTS

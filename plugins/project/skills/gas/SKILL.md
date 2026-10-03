---
name: gas
description: Google Apps Script（GAS）のリポジトリに、clasp で push する src/ 配下の構成と .clasp.json、ファイルの書き分けと GAS 特有の注意点をまとめた規約（.claude/rules/gas.md）を導入する。GAS のプロジェクトを立ち上げる時、または既存の GAS リポジトリへ構成と規約を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象。例: 規約だけ / src だけ / 既存は置き換えない）]"
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
- 既存の Apps Script プロジェクトにつながっている場合は、手元のコードがスクリプトエディタ側と揃っていること。エディタで直接直した内容が手元に無いまま構成を変えて `clasp push` すると、エディタ側の変更が消える。揃っているか分からなければ、始める前に `clasp pull` で取り込んでおく（このスキルは clasp を実行しないため、ユーザーが行う）

## 引数の解釈

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、`DIFF` は手順 5 で 1 件ずつ判断してもらう。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/gas.md` だけ |
| `src だけ` | `src/` 配下だけ |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 5 を飛ばす |

範囲を絞った場合は、`--check` の結果から対象ファイルの相対パスを確定し、手順 4 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。

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

あわせて、既存の GAS コードを Glob で探す（`**/*.gs`・`**/*.js`・`**/*.html`・`**/appsscript.json`・`.clasp.json`。`node_modules/` は除く）。

既存のコードがあり、`.clasp.json` の `rootDir` が `src` 以外（未指定・絶対パスを含む）の場合は、次のどちらにするかをユーザーに選んでもらう。テンプレートは `src/` に置かれるため、決めずにコピーすると、既存のコードと別の場所にテンプレートのコードができてしまう。

| 方針 | 内容 | 向いている場合 |
| --- | --- | --- |
| A：`src/` へ移す | 既存のコードと `appsscript.json` を `src/` へ移し、`rootDir` を `src` にする（手順 3） | テンプレートの構成に揃えたい |
| B：今の場所のまま | コードは動かさず、規約（`gas.md`）だけを入れる。`gas.md` の `paths` を今の場所に書き換える | ファイルの移動を避けたい |

`rootDir` が絶対パス（例：`C:\Users\...`）の場合は、ほかの PC で clone すると push できない。どちらの方針でも、相対パス（A なら `src`、B なら `.` 等）に直すことを提案する。

### 2. 導入計画を提示して承認を得る（必須）

`--check` の結果を、新規作成するファイル（`NEW`）・既存のまま残すファイル（`SAME`）・衝突していて判断が要るファイル（`DIFF`）に分けて提示する。既存の GAS コードがある場合は、手順 1 で選んでもらった方針と、手順 6 で振り分けを行うことも併せて示す。方針 A では、移すファイルの一覧も示す。

`.clasp.json` に `scriptId` が入っている（既存の Apps Script プロジェクトにつながっている）場合は、承認を求める前に、手元のコードがスクリプトエディタ側と揃っているか（前提条件）をユーザーに確認する。揃っているか分からない場合は、`clasp pull` で取り込んでもらってから手順 1 をやり直す。

### 3. 既存コードを `src/` へ移す（方針 A の場合）

テンプレートをコピーする**前に**移す。先にコピーすると、テンプレートの `src/constants.js`・`src/utils.js` などが新しく作られ、同じ名前の既存ファイルを移せなくなるため。

1. 既存のコード（`.js`・`.gs`・`.html`）と `appsscript.json` を、`rootDir` からの相対パスを保ったまま `src/` へ移す。履歴を残すため `git mv` を使う（git 管理外のファイルは通常の移動）
1. `.clasp.json` の `rootDir` を `src` にする。`scriptId` などほかのキーは変えない
1. `--check` をやり直す。既存と同じ名前のテンプレート（例：`src/constants.js`）は `DIFF` になり、手順 4 では上書きされない

`rootDir` からの相対パスが変わらないため、`clasp push` したときの Apps Script 側のファイル名は変わらない。

方針 B の場合はこの手順を飛ばす。手順 4 では `.claude/rules/gas.md` だけをコピーし（`--only .claude/rules/gas.md`）、frontmatter の `paths` を今の `rootDir` に合わせて書き換える（本文は `rootDir` を基準に書いてあるため直さない）。`src/` 配下のテンプレートはコピーしない。テンプレートのコードの中身（スクリプトプロパティの取得・トリガーの登録など）は、手順 6 で既存ファイルへ足す案として出す。

方針 B で `rootDir` 配下に GAS のコードではない JavaScript（ツールの設定ファイル等）がある場合は、`.claspignore` の作成を提案する。`.claspignore` が無いと clasp は `rootDir` 配下の `.js` をすべて push する。GAS で動かないコード（`module.exports` 等）が混ざると読み込みでエラーになり、トリガーを含むすべての関数の実行が失敗するため。すべてを除外してから GAS のファイルだけを戻す形にし、パターンは `rootDir` からの相対パスで書く。既に `.claspignore` がある場合は、足りない除外だけを足す。

```text
**/**
!appsscript.json
!<GAS のコードのファイル・フォルダ>
```

### 4. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill gas --apply
```

対象を絞る場合、または `DIFF` のファイルを上書きする場合は `--only` に相対パスを列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill gas --apply --only .claude/rules/gas.md
```

### 5. 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/gas/files/<同じ相対パス>"
```

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `src/appsscript.json` | 既存を正とする。`oauthScopes`・`dependencies`・`webapp` などの既存のキーは消さない。`timeZone`・`runtimeVersion` が違う場合は、変えるかを確認するだけにする |
| `.clasp.json` | 既存を正とする。`scriptId` は残し、`rootDir` は手順 3 で直した値（方針 A）か既存の値（方針 B。手順 1 で絶対パスを直すことにした場合は直した値）にする |
| `src/*.js` | 既存のコードを捨てない。上書きせず、手順 6 の振り分けで扱う |
| `.claude/rules/gas.md` | 既存の規約に足りない項目だけを足す |

### 6. 既存コードを振り分ける（既存の GAS コードがある場合）

`gas.md` の「ファイルの書き分け」と「関数の命名」を基準に、既存コードの関数・定数ごとに移動先を表で提示する。移動先は、そのコードを使う範囲（1 つの機能だけか、複数の機能か）で決める。

| 列 | 内容 |
| --- | --- |
| 関数・定数 | 名前と現在のファイル |
| 移動先 | 機能ファイル・`constants.js`・`utils.js`・サービスのファイル・`trigger.js`・`main.js` |
| 名前の変更 | 末尾に `_` を付けるか（内部の処理だけ） |

次の関数は外から名前で呼ばれているため、**名前を変えない**（ファイル間の移動はしてよい）。名前を変えると、呼び出し元が動かなくなる。探すときは関数名を Grep し、文字列として書かれている箇所（`'<関数名>'`・`"<関数名>"`）も見る。

- トリガーに登録されている関数（`ScriptApp.newTrigger('<関数名>')` の引数、またはエディタで手動登録したもの）
- カスタムメニューから呼ばれる関数（`Menu.addItem('<表示名>', '<関数名>')` の第 2 引数）
- エディタの実行メニューから手で実行する関数（初期化・一度だけ実行する処理など。README・手順書に実行手順が書かれているもの）
- HTML から `google.script.run` で呼ばれている関数
- `onOpen`・`onEdit`・`doGet`・`doPost` などの予約された名前の関数
- ライブラリとして他のプロジェクトから呼ばれている関数

トリガーから呼ばれる関数を `trigger.js` へ移すときは、登録済みの名前のまま `trigger.js` に入口を置き、処理の本体は機能ファイルに別の名前（末尾 `_`）で残す。

エディタで手動登録したトリガーは、コードからは見えない。README・手順書にトリガーの設定手順が無いか確認し、判断がつかない関数はユーザーに聞く。

承認を得てから移す。移した後は次を行う。

- README・手順書に書かれたファイル名・関数名を、移動先・改名後の名前に直す
- テンプレートの雛形（`main` の `TODO`・`onDailySchedule` 等）が既存の処理と重複する場合は、残すか消すかを確認する。中心となる業務フローが無いプロジェクト（独立した機能が並ぶもの）では、`main.js` を消すことを提案する。テンプレートの `trigger.js` の `onDailySchedule` は `main()` を呼んでいるため、呼び出し先を機能ファイルの関数に替えるか、`onDailySchedule` ごと消す（あわせて `setupTriggers`・`deleteTriggers` も見直す）ことを、同じ提案に含める

### 7. `.gitignore` を整える

次の行が `.gitignore` に無ければ、追記を提案する（`.gitignore` が無ければ作成を提案する）。

| 行 | 理由 |
| --- | --- |
| `.clasprc.json` | `clasp login --creds` を使うと、認証情報が作業ディレクトリに保存されるため |

`.clasp.json` は除外しない。`scriptId` は秘匿値ではなく、リポジトリを clone してすぐ push できるようにするためコミットする。

### 8. 導入後にやることを伝える

コピーが終わったら、次を残作業としてユーザーに提示する。既存のプロジェクトで済んでいる項目は省く。

1. clasp を入れてログインする（`npm install -g @google/clasp` → `clasp login`）。初回は [Apps Script のユーザー設定](https://script.google.com/home/usersettings) で Google Apps Script API を有効にする
1. Apps Script のプロジェクトを用意し、エディタの「プロジェクトの設定」にあるスクリプト ID を `.clasp.json` の `scriptId` に書き込む
1. 既にコードがあるプロジェクトにつなぐ場合は、push の前に `clasp pull` で取り込み、手順 6 の振り分けを行う。pull するとリモートと同じ名前のローカルファイルはリモートの内容で上書きされる
1. `src/constants.js` の `TODO:` を埋める。秘匿値はエディタの「プロジェクトの設定」→「スクリプト プロパティ」に登録し、キー名を `PROPERTY_KEYS` に書く
1. `clasp push` で反映し、定期実行を使う場合はエディタから `setupTriggers` を 1 回実行する（初回は権限の承認を求められる）。定期実行を使わない場合は `trigger.js` の雛形を消す

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存の関数を承認なしに移動・改名しない。上記「名前を変えない」関数は承認があっても改名を提案しない
- `clasp push` / `clasp pull` / `clasp login` など、リモートへの反映や認証を伴うコマンドを実行しない（人が実行する）
- コピー結果をコミットしない（コミットは人が行う）

$ARGUMENTS

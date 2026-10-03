---
name: conflicts
description: 現在の Claude Code の設定（managed / user / project / local の settings.json・権限ルール・フック・MCP サーバー・スキル・CLAUDE.md と rules）を横断して、衝突・重複・効いていない設定を点検し、修正案付きのレポートを出す。設定が思ったとおりに効かない時、プラグインや設定を追加した後に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node --version:*)
argument-hint: "[重点的に見たい観点（任意。例: 権限 / フック / CLAUDE.md）]"
---

# 設定の衝突点検（conflicts）

Claude Code の設定はスコープ（managed / local / project / user）ごとに分かれ、上位のスコープが下位を上書きする。配列（権限ルール・フック）はスコープ間で結合される。このため「書いたのに効かない」「同じものが二重に定義されている」状態が起きやすい。このスキルはそれを洗い出す。

標準の `/doctor`（インストールの状態・壊れた設定ファイル・使われていない拡張機能などの点検）とは対象が違う。設定ファイルが壊れていないかではなく、正しく書かれた設定どうしがぶつかっていないかを見る。

**読み取り専用**。修正案は出すが、設定ファイルは書き換えない。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/conflicts/scripts/conflicts.js` | 機械的に判定できる衝突・重複を JSON で出力する |

## 点検する観点

| カテゴリ | 内容 | 判定 |
| --- | --- | --- |
| `scalar-override` | 同じキーが複数スコープにあり、上位の値で上書きされている（`model`・`language`・`statusLine`・`env.*`・`permissions.defaultMode` 等） | スクリプト |
| `permission-conflict` | `allow` のルールが `deny` / `ask` のルールに覆われて効かない（評価順は deny → ask → allow） | スクリプト |
| `permission-duplicate` | 同じルールが複数スコープに重複している | スクリプト |
| `hook-duplicate` | 同じイベント・matcher・コマンドのフックが複数箇所にある（設定ファイル間の重複は 1 回にまとめられるが、プラグイン側の重複は別に実行される） | スクリプト |
| `mcp-duplicate` | 同名の MCP サーバーが複数箇所（`~/.claude.json`・`.mcp.json`・プラグイン）で定義されている | スクリプト |
| `skill-collision` | 同名のスキル・コマンドがユーザーとプロジェクト（またはプラグイン）にある | スクリプト |
| `memory-conflict` | `CLAUDE.md`・`rules/*.md` の指示同士が矛盾している、または設定と食い違っている | Claude が読んで判定 |

## 手順

### 1. スクリプトを実行する

プロジェクトのルート（またはその配下）で実行する。`node --version` で Node.js があることを先に確認する。

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/conflicts/scripts/conflicts.js"
```

出力は JSON。主なキーは次のとおり。

| キー | 内容 |
| --- | --- |
| `settingsFiles` | 読んだ設定ファイルと、その有無（優先度の高い順） |
| `enabledPlugins` | 有効なプラグイン |
| `findings` | 検出結果。`severity` は `warn`（効いていない・二重実行など実害あり）か `info`（冗長なだけ） |
| `memoryFiles` | 読み込まれる `CLAUDE.md`・`rules/*.md` の一覧 |
| `errors` | JSON として読めなかったファイルなど |

`errors` にファイルが挙がった場合は、その設定ファイル自体が壊れていて**丸ごと効いていない**可能性がある。最優先で報告する。

### 2. 検出結果を確かめる

`findings` をそのまま転記せず、`warn` のものは該当の設定ファイルを Read して裏を取る。

- `permission-conflict` で `exact: false` のものは、ワイルドカードの解釈による推定。両ルールを見比べて、本当に覆われているかを判断する
- `scalar-override` は、上位スコープの値が意図的な上書き（プロジェクトだけモデルを変える等）なら問題ではない。意図が読み取れない場合は「意図的か確認が要る」として報告する

### 3. CLAUDE.md・rules の矛盾を判定する

`memoryFiles` の各ファイルを Read し、次を探す。

- 同じ事柄について逆の指示（例：「コメントは英語」と「コメントは日本語」）
- 設定と食い違う指示（例：`language` が `japanese` なのに「英語で応答する」、deny されているコマンドを手順で実行させている）
- 同じ指示の重複（片方を直すともう片方が古いまま残るもの）

矛盾と判定するのは、両方を同時に守れない場合だけにする。適用範囲（`paths:` の指定）が異なるルール同士は矛盾ではない。

### 4. レポートを出す

チャットに次の構成で出力する。ファイルには書き出さない。

```markdown
## 設定の点検結果

読んだ設定: user / project（managed・local は無し）、有効なプラグイン 2 件

### 要対応（warn）

| # | カテゴリ | 内容 | 場所 | 修正案 |
| --- | --- | --- | --- | --- |
| 1 | permission-conflict | allow の Bash(git push origin *) は deny の Bash(git push *) に覆われていて効かない | ~/.claude/settings.json / .claude/settings.json | 意図どおりなら allow から削除する |

### 整理推奨（info）

（同じ形式の表）

### 問題なし

（観点ごとに、検出が無かったものを 1 行で列挙する）
```

- 場所はファイルパスで示す（スコープ名だけにしない）
- 修正案は「どのファイルのどのキーをどうするか」まで具体的に書く
- 検出ゼロの観点も「問題なし」に挙げ、点検したことが分かるようにする

## 禁止事項

- 設定ファイル・`CLAUDE.md`・rules を書き換えない（修正はユーザーが判断して行う）
- `~/.claude.json` を直接 Read しない。認証情報などが含まれるため、MCP の定義はスクリプトの出力（起動方法だけを抜き出したもの）から読む
- MCP サーバーの `env`・`headers` の値をレポートに書かない

$ARGUMENTS

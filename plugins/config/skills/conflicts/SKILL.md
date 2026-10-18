---
name: conflicts
description: 現在の Claude Code の設定（managed / user / project / local の settings.json・権限ルール・フック・MCP サーバー・スキル・CLAUDE.md と rules）を横断して、衝突・重複・効いていない設定を点検し、修正案付きのレポートを出す。設定が思ったとおりに効かない時、プラグインや設定を追加した後に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node --version:*)
argument-hint: "[重点的に見たい観点（任意。省略時はすべての観点を同じ重さで点検する。例: 権限 / フック / CLAUDE.md）]"
---

# 設定の衝突点検（conflicts）

現在の Claude Code の設定を横断して、衝突・重複・効いていない設定を点検し、修正案付きのレポートをチャットに出す。**読み取り専用**で、修正案は出すが設定ファイルは書き換えない。

- 外へ書き込むもの：なし（レポートはチャットに出し、ファイルには書き出さない）
- 人がすること：修正案を見て、設定ファイルを直すかを決め、直す

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/conflicts/scripts/conflicts.js` | 手順 1 で実行する。機械的に判定できる衝突・重複・書き方の誤りを JSON で出力する |
| `${CLAUDE_PLUGIN_ROOT}/skills/conflicts/background.md` | 設定のスコープの上書きの仕組みや、標準の `/doctor` との違いを伝えるとき |

## 想定している引数

引数に、重点的に見たい観点（例：権限 / フック / CLAUDE.md）を受け取る。任意で、省略時はすべての観点を同じ重さで点検する。

## 出力先

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

（観点ごとに、検出が無かったものを照合した件数とともに 1 行で列挙する）

- mcp-duplicate：ユーザー 3 件・プロジェクト 1 件・プラグイン 2 件を照合し、重なりなし

### 照合できなかったもの

（`unchecked` と、`coverage` で照合できていないと判断したもの。無ければ「なし」）
```

- 場所はファイルパスで示す（スコープ名だけにしない）
- 修正案は「どのファイルのどのキーをどうするか」まで具体的に書く
- 検出ゼロの観点も「問題なし」に挙げ、**照合した件数**を添えて点検したことが分かるようにする。件数を書けない観点は「問題なし」にしない

## 手順

点検する観点は次のとおり。

| カテゴリ | 内容 | 判定 |
| --- | --- | --- |
| `scalar-override` | 同じキーが複数スコープにあり、上位の値で上書きされている（`model`・`language`・`statusLine`・`env.*`・`permissions.defaultMode` 等） | スクリプト |
| `permission-conflict` | `allow` のルールが `deny` / `ask` のルールに、`ask` のルールが `deny` のルールに覆われて効かない（評価順は deny → ask → allow） | スクリプト |
| `permission-duplicate` | 同じルールが複数スコープに重複している | スクリプト |
| `permission-syntax` | Bash の権限ルールが書き方の誤りで意図したコマンドに一致しない（`*` と末尾の `:*` の混在、末尾以外の `:*`） | スクリプト |
| `hook-duplicate` | 同じイベント・matcher・コマンドのフックが複数箇所にある（設定ファイル間の重複は 1 回にまとめられるが、プラグイン側の重複は別に実行される） | スクリプト |
| `mcp-duplicate` | 同名の MCP サーバーが複数箇所（`~/.claude.json`・`.mcp.json`・プラグイン）で定義されている | スクリプト |
| `skill-collision` | 同名のスキル・コマンドがユーザーとプロジェクト（またはプラグイン）にある、または複数のプラグインにある | スクリプト |
| `memory-conflict` | `CLAUDE.md`・`rules/*.md` の指示同士が矛盾している、または設定と食い違っている | Claude が読んで判定 |

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
| `coverage` | 出どころごとに照合した件数（設定ファイル・権限ルール・フック・MCP サーバー・スキル） |
| `findings` | 検出結果。`severity` は `warn`（効いていない・二重実行など実害あり）か `info`（冗長なだけ） |
| `memoryFiles` | 読み込まれる `CLAUDE.md`・`rules/*.md` の一覧 |
| `unchecked` | 照合できなかったもの（MCP バンドル `.mcpb` など、展開しないと中身が読めないもの） |
| `errors` | JSON として読めなかったファイルなど |

`env` の値・`apiKeyHelper` 等の値、MCP サーバーの引数のうちトークンらしいもの（`--token` 等の直後の値）と URL の認証情報・クエリ文字列は、`<redacted>` に伏せて出力される。値が違うかどうかの判定は伏せる前の値で行っている。

プラグインのスキル・コマンド・フック・MCP サーバーは、既定の場所（`skills/`・`commands/`・`hooks/hooks.json`・`.mcp.json`）に加えて、マニフェスト（`.claude-plugin/plugin.json`）でパスを指定したものも読む。

`errors` にファイルが挙がった場合は、その設定ファイル自体が壊れていて**丸ごと効いていない**可能性がある。最優先で報告する。

`coverage` で、有効なプラグインのスキルが 0 件になっているものは、照合できていない可能性がある。プラグインの導入先を Glob で見て `SKILL.md` があるかを確かめ、あれば「照合できていない」としてレポートに書く（検出ゼロを「問題なし」にしない）。

### 2. 検出結果を確かめる

`findings` をそのまま転記せず、`warn` のものは該当の設定ファイルを Read して裏を取る。

- `permission-conflict` で `exact: false` のものは、ワイルドカードの解釈による推定。両ルールを見比べて、本当に覆われているかを判断する
- `permission-syntax` の `suggestion` は「`*` だけで書き直した形」で、一致する範囲が元の意図より広がることがある。deny / ask のルールなら止めたくないコマンドまで止めないか、allow のルールなら許可しすぎないかを確かめてから修正案に書く。書き方の誤りがあるルールは、`permission-conflict` の照合から外している
- `scalar-override` は、上位スコープの値が意図的な上書き（プロジェクトだけモデルを変える等）なら問題ではない。意図が読み取れない場合は「意図的か確認が要る」として報告する

### 3. CLAUDE.md・rules の矛盾を判定する

`memoryFiles` の各ファイルを Read し、次を探す。

- 同じ事柄について逆の指示（例：「コメントは英語」と「コメントは日本語」）
- 設定と食い違う指示（例：`language` が `japanese` なのに「英語で応答する」、deny されているコマンドを手順で実行させている）
- 同じ指示の重複（片方を直すともう片方が古いまま残るもの）

矛盾と判定するのは、両方を同時に守れない場合だけにする。適用範囲（`paths:` の指定）が異なるルール同士は矛盾ではない。

### 4. レポートを出す

「出力先」の構成で、チャットに出す。

## 禁止事項

- 設定ファイル・`CLAUDE.md`・rules を書き換えない（修正はユーザーが判断して行う）
- `~/.claude.json` を直接 Read しない。認証情報などが含まれるため、MCP の定義はスクリプトの出力（起動方法だけを抜き出したもの）から読む
- MCP サーバーの `env`・`headers` の値をレポートに書かない。裏取りで設定ファイルを Read した場合も、`<redacted>` に伏せられた値をレポートに書き戻さない

$ARGUMENTS

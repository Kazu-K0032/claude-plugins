# 点検する観点とスクリプトの出力

手順 1 でスクリプトの出力を読むとき、手順 2 で検出結果を確かめるときに読む。

## 点検する観点

| カテゴリ | 内容 | 判定 |
| --- | --- | --- |
| `scalar-override` | 同じキーが複数スコープにあり、上位の値で上書きされている（`model`・`language`・`statusLine`・`env.*`・`permissions.defaultMode` 等） | スクリプト |
| `permission-conflict` | `allow` のルールが `deny` / `ask` のルールに、`ask` のルールが `deny` のルールに覆われて効かない（評価順は deny → ask → allow） | スクリプト |
| `permission-duplicate` | 同じルールが複数スコープに重複している | スクリプト |
| `permission-syntax` | Bash の権限ルールが書き方の誤りで意図したコマンドに一致しない（`*` と末尾の `:*` の混在、末尾以外の `:*`） | スクリプト |
| `hook-duplicate` | 同じイベント・matcher・コマンドのフックが複数箇所にある（設定ファイル間の重複は 1 回にまとめられるが、プラグイン側の重複は別に実行される） | スクリプト |
| `mcp-duplicate` | 同名の MCP サーバーが複数箇所（`~/.claude.json`・`.mcp.json`・プラグイン）で定義されている | スクリプト |
| `skill-collision` | 同名のスキル・コマンドがユーザーとプロジェクト（またはプラグイン）にある、または複数のプラグインにある | スクリプト |
| `memory-conflict` | `CLAUDE.md`・`rules/*.md` の指示同士が矛盾している、または設定と食い違っている | Claude が読んで判定（手順 3） |

## スクリプトの出力

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

- `env` の値・`apiKeyHelper` 等の値、MCP サーバーの引数のうちトークンらしいもの（`--token` 等の直後の値）と URL の認証情報・クエリ文字列は、`<redacted>` に伏せて出力される。値が違うかどうかの判定は伏せる前の値で行っている
- プラグインのスキル・コマンド・フック・MCP サーバーは、既定の場所（`skills/`・`commands/`・`hooks/hooks.json`・`.mcp.json`）に加えて、マニフェスト（`.claude-plugin/plugin.json`）でパスを指定したものも読む

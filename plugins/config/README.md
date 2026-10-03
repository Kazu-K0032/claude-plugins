# config

ユーザー全体（`~/.claude/`）の Claude Code 設定を整える Skill 集。どのリポジトリで作業していても共通の設定（ステータスライン・応答言語）を入れることと、スコープをまたいだ設定の衝突・重複を点検することを扱う。

リポジトリ単位の設定（`.claude/`・`.github/` 等）は [project](../project/README.md) の `/project:init-repo` が扱う。

## 収録スキル

| スキル | 用途 |
| --- | --- |
| `/config:setup-global` | `~/.claude/settings.json` に 2 行のステータスラインと日本語での応答（`language`）を設定 |
| `/config:conflicts` | settings.json の各スコープ・権限ルール・フック・MCP サーバー・スキル・CLAUDE.md を横断して、衝突・重複を点検 |

標準の `/doctor` とは見る観点が違う。`/doctor` はインストールの状態・壊れた設定ファイル・使われていない拡張機能・コンテキストの使用量を点検する。`/config:conflicts` は、スコープ間の上書き・deny に覆われた allow・フックや MCP の重複定義・CLAUDE.md 同士の矛盾など、**設定どうしがぶつかって効いていないもの**を点検する。

## 導入

ユーザー全体の設定を扱うため、**user スコープ**でインストールする。

```bash
/plugin install config@kazu
```

## ディレクトリ構成

```text
config/
├── .claude-plugin/
│   └── plugin.json          # プラグインのマニフェスト
└── skills/
    ├── setup-global/
    │   ├── SKILL.md
    │   └── scripts/
    │       └── statusline.js  # ステータスラインの本体（~/.claude/statusline/ へコピーして使う）
    └── conflicts/
        ├── SKILL.md
        └── scripts/
            └── conflicts.js   # 衝突・重複を JSON で出力する点検スクリプト
```

## 設計上の決めごと

- **スクリプトは Node.js で書き、外部パッケージを使わない**。ステータスラインは描画のたびに実行されるため、`jq` のような追加ツールに頼らず、Windows・macOS・Linux で同じように動くようにする
- **ステータスラインのスクリプトは `~/.claude/` へコピーして使う**。プラグインは `statusLine` を設定できず、ユーザーの `settings.json` では `${CLAUDE_PLUGIN_ROOT}` が展開されないため。プラグインの更新後は `/config:setup-global` を再実行してコピーし直す
- **既存の設定は承認なしに上書きしない**。`setup-global` は変更前後の値を表で見せてから書き込む
- **`conflicts` は読み取り専用**。修正案は出すが、設定ファイルは書き換えない。`~/.claude.json` は認証情報を含むため、スクリプトが MCP の起動方法だけを抜き出して渡す

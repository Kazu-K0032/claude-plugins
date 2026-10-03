# claude-plugins

[Claude Code](https://code.claude.com/docs/) の個人用プラグインマーケットプレイス（＝プラグインのカタログ）。複数のプロジェクト・複数の PC で同じ Skill を使い回すために公開している。

## 収録プラグイン

| プラグイン | 内容 | 呼び出し例 |
| --- | --- | --- |
| [aidd](plugins/aidd/README.md) | AIDD × DocDD の定型作業（ADR・コミット・PR 準備・技術調査・ドキュメント追従チェック・利用分析レポート） | `/aidd:adr` |
| [config](plugins/config/README.md) | ユーザー全体（`~/.claude/`）の Claude Code 設定（ステータスライン・日本語化）の導入と、設定の衝突・重複の点検 | `/config:conflicts` |

リポジトリへ規約一式（`.claude/`・`.github/`・`.vscode/`・ドキュメントの骨組み）を持ち込む [`/aidd:init-repo`](plugins/aidd/skills/init-repo/README.md) も同梱している。プラグイン由来の Skill は必ず `/プラグイン名:スキル名` の形で呼び出す。

## 導入

Claude Code のセッション内で次を実行する。カタログを 1 回登録すれば、中のプラグインを個別にインストールできる。

```bash
/plugin marketplace add Kazu-K0032/claude-plugins
/plugin install aidd@kazu
/plugin install config@kazu
```

インストール時にスコープ（user / project / local）を選ぶ。複数の PC で使うなら、リポジトリに設定が入る **project スコープ**が楽。`config` はユーザー全体の設定を扱うため **user スコープ**で入れる。パブリックリポジトリのため、利用側に認証設定は不要。

## 更新

サードパーティのマーケットプレイスは自動更新が既定で無効。更新は明示的に取得する。

```bash
/plugin marketplace update kazu
/reload-plugins
```

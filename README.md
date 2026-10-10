# claude-plugins

[Claude Code](https://code.claude.com/docs/) の個人用プラグインマーケットプレイス（＝プラグインのカタログ）。複数のプロジェクト・複数の PC で同じ Skill を使い回すために公開している。

## 収録プラグイン

| プラグイン | 内容 | 呼び出し例 |
| --- | --- | --- |
| [aidd](plugins/aidd/README.md) | AIDD × DocDD の定型作業（ADR・Issue の着手から実装まで・コミット・PR 準備・Issue/PR 更新・技術調査・ドキュメント追従チェック・利用分析レポート） | `/aidd:adr` |
| [config](plugins/config/README.md) | ユーザー全体（`~/.claude/`）の Claude Code 設定（ステータスライン・日本語化）の導入、設定の衝突・重複の点検、プラグインの不具合・改善案の起票、サイドバーのボタンで応答・文書の書き方とチャットモードを切り替える mod の導入 | `/config:conflicts` |
| [project](plugins/project/README.md) | リポジトリ単位の規約・足場（ハーネス設定・GitHub の定型ファイル・ドキュメントの骨組み・技術スタック別の構成と規約）の導入 | `/project:init-repo` |

プラグイン由来の Skill は必ず `/プラグイン名:スキル名` の形で呼び出す。

プラグインが何をして何をしないか（コミットしない・外部へ書き込まないなど）と、その理由は [設計の方針](docs/policies/README.md) にまとめている。方針の土台になる考え方は [AI駆動開発の価値](docs/values/README.md) にある。

## 導入

Claude Code のセッション内で次を実行する。カタログを 1 回登録すれば、中のプラグインを個別にインストールできる。

```bash
/plugin marketplace add Kazu-K0032/claude-plugins
/plugin install aidd@kazu
/plugin install config@kazu
/plugin install project@kazu
```

インストール時にスコープ（user / project / local）を選ぶ。複数の PC で使うなら、リポジトリに設定が入る **project スコープ**が楽。`config` はユーザー全体の設定を扱うため **user スコープ**で入れる。`project` も新しいリポジトリの立ち上げで使うため **user スコープ**で入れる。パブリックリポジトリのため、利用側に認証設定は不要。

## 更新

サードパーティのマーケットプレイスは自動更新が既定で無効。更新は明示的に取得する。

```bash
/plugin marketplace update kazu
/reload-plugins
```

更新が届くのは、版を上げてリリースしたときだけ。変更点は [Releases](https://github.com/Kazu-K0032/claude-plugins/releases) で見られる。リリースの手順は [docs/release.md](docs/release.md) にある。

`/aidd:init-repo` は `/project:init-repo` に移った。以前から `aidd` を使っている場合は、`project` プラグインを追加でインストールする。

### 前の版に戻す

不具合のある版が届いたら、タグ（例：`v1.0.0`）を付けて登録し直す。登録を外すと、このカタログから入れたプラグインがすべて外れ、保存した設定も消える。外す前に `/plugin` の **Installed** で入れていたプラグインとスコープを控え、同じスコープで入れ直す。

```bash
/plugin marketplace remove kazu
/plugin marketplace add Kazu-K0032/claude-plugins#v1.0.0
/plugin install aidd@kazu
/plugin install config@kazu
/plugin install project@kazu
```

project スコープで入れていた場合は、外したときにリポジトリの `.claude/settings.json` も書き換わる。入れ直した後に差分が残っていないかを確かめる。

最新に戻すときは、タグを付けずに同じ手順で登録し直す。

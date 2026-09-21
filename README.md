# claude-plugins

[Claude Code](https://code.claude.com/docs/) の個人用プラグインマーケットプレイス。複数のプロジェクト・複数の PC で同じ Skill を使い回すために公開している。

「マーケットプレイス」は Claude Code から見た**プラグインのカタログ**にあたる。カタログを 1 回登録すると、その中のプラグインを個別にインストールできる。

## 収録プラグイン

| プラグイン | 内容 | 呼び出し例 |
| --- | --- | --- |
| [aidd](plugins/aidd/README.md) | AIDD × DocDD の定型作業（ADR・ナレッジ・コミット・PR 準備・技術調査） | `/aidd:adr` |

## リポジトリへの規約の持ち込み

`.claude/rules/`（対象ファイルを開いた時に自動適用される規約）や `.github/` の定型ファイルは、プラグインからは配布できない。これらはテンプレートとして `aidd` プラグインに同梱し、Skill でリポジトリへコピーする。

```text
/aidd:init-repo
```

収録物と除外理由は [init-repo の README](plugins/aidd/skills/init-repo/README.md) を参照。

## 導入方法

Claude Code のセッション内で次を実行する。

```bash
/plugin marketplace add Kazu-K0032/claude-plugins
/plugin install aidd@kazu
```

インストール時にスコープを選ぶ。用途に応じて使い分ける。

| スコープ | 効く範囲 | 書き込まれる先 |
| --- | --- | --- |
| user | その PC の全プロジェクト | `~/.claude/settings.json` |
| project | そのリポジトリを clone した全 PC | `.claude/settings.json`（コミット対象） |
| local | そのリポジトリの自分だけ | `.claude/settings.local.json` |

複数の PC で使うなら **project スコープ**が楽になる。リポジトリに設定が入るため、別の PC で clone した時点で有効になる。

### 設定を手で書く場合

`settings.json` に次の 2 キーを書いても同じ結果になる。

```json
{
  "extraKnownMarketplaces": {
    "kazu": {
      "source": { "source": "github", "repo": "Kazu-K0032/claude-plugins" }
    }
  },
  "enabledPlugins": { "aidd@kazu": true }
}
```

パブリックリポジトリなので、利用側に認証設定（`gh auth` や SSH 鍵）は不要。

## 更新の受け取り方

サードパーティのマーケットプレイスは自動更新が既定で無効。更新は明示的に取得する。

```bash
/plugin marketplace update kazu
/reload-plugins
```

## 呼び出し名について

プラグイン由来の Skill は必ず `/プラグイン名:スキル名` の形になる（例 `/aidd:adr`）。プロジェクトの `.claude/skills/` に同名の Skill があっても衝突せず、両方が使える。

## 開発

### clone

```bash
# 個人アカウント用の SSH エイリアス経由で clone する
git clone git@github-kazu-k0032:Kazu-K0032/claude-plugins.git
cd claude-plugins

# コミット identity をこのリポジトリだけに設定する（global は未設定のため必須）
git config --local user.name  "Kazu"
git config --local user.email "111069418+Kazu-K0032@users.noreply.github.com"
```

### 編集中の動作確認

push 前に試すなら `--plugin-dir` でセッション限定で読み込む。マーケットプレイスへの登録もキャッシュへのコピーも起きないため、GitHub 経由の登録（同名 `kazu`）と競合しない。

```bash
claude --plugin-dir ./plugins/aidd
```

マニフェストの構文確認だけなら CLI で足りる。

```bash
claude plugin validate .
```

### リリース

```bash
# 1. plugin.json の version を上げる（上げたコミットだけが更新として届く）
# 2. push する
git push

# 3. 利用側で取得する
/plugin marketplace update kazu
/reload-plugins
```

### 制約

プラグインはインストール時に `~/.claude/plugins/cache` へコピーされる。そのため**プラグインディレクトリの外にあるファイルは参照できない**（`../../shared` のようなパスは動かない）。プラグイン内のファイルは `${CLAUDE_PLUGIN_ROOT}` からの絶対パスで参照する。

## ライセンス

MIT

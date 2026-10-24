# <repository-name>

TODO: このリポジトリが何の案件・何のプロダクトのものかを 1〜2 行で書く。

README は**どこに何があるかを示す入口**として扱う。内容そのものは各ドキュメントに置き、ここには、各サブツリーの入口（`docs/README.md` など）・ルートの設定ファイル・外部サービスへのリンクだけを書く。

## 各環境のリンク

### ローカル

TODO: ローカル起動時に開く URL を列挙する（アプリ・管理画面・メール検証 UI 等）。

- アプリ: <http://localhost:3000>

### 本番

TODO: 公開 URL とアクセス制限を表で示す。認証情報そのものは README に直書きしない。

| 層 | URL | アクセス制限 |
| --- | --- | --- |
| 公開配信 | <https://example.com/> | なし（一般公開） |
| 管理画面 | <https://example.com/admin/> | 許可 IP 限定 |

### 検証（STG）

TODO: 検証環境の URL とアクセス制限を表で示す。資格情報の保管場所（シークレットマネージャ等）だけを書き、値は書かない。

| 層 | URL | アクセス制限 |
| --- | --- | --- |
| 公開配信 | <https://stg.example.com/> | Basic 認証 |

## ディレクトリ構成

[CLAUDE.md](CLAUDE.md) を参照。

## 開発支援ツール

TODO: MCP サーバー・エディタ設定など、開発を支える仕組みへのリンクを列挙する。

- Claude Code のプラグイン: [claude-plugins](https://github.com/Kazu-K0032/claude-plugins)
- VS Code の推奨拡張機能: [.vscode/extensions.json](.vscode/extensions.json)
- スペルチェックの設定と除外語: [cspell.json](cspell.json)
- Lint・整形のツールと、コミットのメッセージの検査の定義: [lefthook.yml](lefthook.yml)

## ドキュメント系

環境構築・仕様・設計・ADR などの文書は、[docs/README.md](docs/README.md) からたどる。個別の文書へのリンクは `docs/README.md` に置き、ここには足さない。

## 外部リンク系

TODO: リポジトリ外にある情報源（クラウドのポータル・ドライブ・デザインツール等）を列挙する。

- [GitHub](https://github.com/)

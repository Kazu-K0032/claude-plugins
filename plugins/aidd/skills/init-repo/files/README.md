# <repository-name>

TODO: このリポジトリが何の案件・何のプロダクトのものかを 1〜2 行で書く。

README は**全ドキュメントへのリンクを集約するエントリポイント**として扱う。内容そのものは各ドキュメントに置き、ここには「どこに何があるか」と「外部サービスのリンク」だけを書く。

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

TODO: 検証環境の URL とアクセス制限を表で示す。資格情報の保管場所（Terraform 変数・シークレットマネージャ等）だけを書き、値は書かない。

| 層 | URL | アクセス制限 |
| --- | --- | --- |
| 公開配信 | <https://stg.example.com/> | Basic 認証 |

## 環境構築

TODO: 手順の本体は `docs/runbook/environment-setup.md` に置き、ここからはリンクするだけにする。

## ディレクトリ構成

[CLAUDE.md](CLAUDE.md) を参照。

## 開発支援ツール

TODO: MCP サーバー・エディタ設定など、開発を支える仕組みへのリンクを列挙する。

- Claude Code のプラグイン: [claude-plugins](https://github.com/Kazu-K0032/claude-plugins)

## ドキュメント系

ドキュメント全体の案内板は [docs/README.md](docs/README.md)。

TODO: 以下は雛形。**実在する文書へのリンクだけを残す**（リンク先を作っていない行は削除する）。

### 仕様

- [要件定義](docs/specs/specifications.md) — 機能要件・非機能要件

### アーキテクチャ

- [アーキテクチャ概要](docs/architecture/architecture.md)
- [CI/CD 構成](docs/architecture/ci-cd.md)

### 戦略

- [開発戦略](docs/strategies/development.md)
- [テスト戦略](docs/strategies/test-strategy.md)

### ADR

- [README](docs/adr/README.md)

### 手順書 (Runbook)

- [runbook/README.md](docs/runbook/README.md)

### 知識共有 (Knowledge)

- [knowledge/README.md](docs/knowledge/README.md) — ツール・プラグインの入門知識（1 ツール 1 ファイル）

## 外部リンク系

TODO: リポジトリ外にある情報源（クラウドのポータル・ドライブ・デザインツール等）を列挙する。

- [GitHub](https://github.com/)

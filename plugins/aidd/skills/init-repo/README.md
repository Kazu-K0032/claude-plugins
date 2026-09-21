# init-repo

新しいリポジトリへ「Claude Code のハーネス設定（`.claude/`）＋ GitHub の定型ファイル（`.github/`）＋ ドキュメントの骨組み」を一括で持ち込む Skill。実案件リポジトリの構成から、プロジェクト固有の要素を取り除いて汎用化したもの。

`files/` の中身がそのまま導入先リポジトリのルートに置かれる。

## 使い方

導入先のリポジトリのルートで Claude Code を開き、次を実行する。

```text
/aidd:init-repo
```

衝突状況の確認 → 計画の提示 → 承認 → コピー、の順に進む。既存ファイルは承認なしに上書きされない。手順の詳細は [SKILL.md](SKILL.md) を参照。

Claude を介さず手で入れる場合は、スクリプトを直接叩いてもよい（リポジトリのルートで実行する）。

```bash
bash <plugin>/skills/init-repo/scripts/install.sh --check   # 状態確認だけ
bash <plugin>/skills/init-repo/scripts/install.sh --apply   # 未存在のファイルだけコピー
```

## 収録物

| パス | 内容 | 導入後の調整 |
| --- | --- | --- |
| `files/.claude/settings.json` | 権限（秘匿ファイルの deny・`*.example` の allow）とフックの設定 | 秘匿ファイルの deny パスをプロジェクトに合わせる |
| `files/.claude/hooks/guard-destructive.sh` | 破壊的コマンドを検出して承認へエスカレーションする PreToolUse フック | `patterns` にプロジェクト固有の破壊的操作を追記する |
| `files/.claude/hooks/guard-git-write.sh` | `git commit` / `git push` / `gh` 書き込みを Claude に実行させないガード（既定では未配線） | 使う場合は settings.json の PreToolUse に追加する |
| `files/.claude/hooks/post-edit-lint.sh` | 編集後に Lint を流す PostToolUse フック（非ブロッキング） | 冒頭の `LINT_DIR` / `TARGET_PREFIX` と言語別ブロックを調整する |
| `files/.claude/hooks/session-start.sh` | セッション開始時に運用ルールを通知する SessionStart フック | 文言を変えるだけ |
| `files/.claude/rules/comment.md` | インラインコメントの規約（なぜを書く・読み手を選ばない言葉） | そのまま使える |
| `files/.claude/rules/env.md` | 環境変数と `*.example` の追従ルール | 変数の種類と追記先の表 |
| `files/.claude/rules/github-actions.md` | ワークフローの実装ルール（最小権限・SHA 固定・インジェクション対策） | そのまま使える |
| `files/.claude/rules/readme.md` | README を案内板として運用するための規約 | README の種別表 |
| `files/.github/ISSUE_TEMPLATE/` | Issue フォーム（機能要求 / リファクタ / リリース / AIDD 振り返り） | `config.yml` の検証環境リンク、`release.yml` の手順 |
| `files/.github/PULL_REQUEST_TEMPLATE.md` | PR テンプレート（AI 有無で分けたチェックリスト） | ローカル確認 URL・チェック項目 |
| `files/.github/dependabot.yml` | GitHub Actions の依存更新（月次・1 PR にまとめる） | そのまま使える |
| `files/.github/labels.yml` | ラベル定義（`sync-labels.yml` が GitHub へ同期） | ラベルの追加・削除 |
| `files/.github/workflows/pr-checks.yml` | PR 差分のシークレットスキャン（gitleaks） | そのまま使える |
| `files/.github/workflows/sync-labels.yml` | `labels.yml` を GitHub のラベルへ同期 | そのまま使える |
| `files/docs/README.md` | ドキュメントの案内板（サブディレクトリの振り分け表） | 使わない行の削除・サブディレクトリ作成時のリンク追加 |
| `files/CLAUDE.md` | Claude Code 向けガイドの骨組み（禁止事項・手順ルール・SSOT 一覧・ディレクトリ） | `TODO:` 行を実態に書き換える |
| `files/README.md` | README の骨組み（リンク集約型の構成） | `TODO:` 行を実態に書き換える |
| `files/commitlint.config.js` | Conventional Commits の検証設定（日本語の件名前提） | 許可する type |

## 前提と制約

- フックは `bash` と [`jq`](https://jqlang.org/) を使う。どちらも無い環境ではフックが失敗する
- `settings.json` の `permissions.deny` は「コマンド先頭一致」でしか判定しない。ラッパースクリプト経由の実行まで塞ぐなら `guard-git-write.sh` を配線する
- `attribution` を空文字にしているため、コミットメッセージと PR 本文に Claude の署名行が付かない。署名を残したい場合はこのキーごと削除する
- `permissions.allow` で `*.example`（`.env.example` 等）の読み書きを明示的に許可している。秘匿ファイルの deny は実体（`.env` 等）だけを対象にしており、example は含まない
- `permissions.defaultMode` とモデルは指定していない。ユーザー設定または `/config` の値が使われる
- `commitlint.config.js` は設定だけ。実行には `@commitlint/cli` と `@commitlint/config-conventional` の導入と、`commit-msg` フックの配線が要る

## 除外したもの

導入先で使い回せない、またはプロジェクト固有の前提が強いものは収録していない。

| 除外したもの | 理由 |
| --- | --- |
| Copilot 向けの指示ファイル（`.github/copilot-instructions.md`・`.github/instructions/`） | 本テンプレートは Claude Code のハーネスを対象にする |
| ビルド・テストの CI ワークフロー | 言語・フレームワーク依存。中身はプロジェクトごとに作る |
| デプロイ系ワークフロー | 配信構成（ホスティング・CDN・静的化）専用 |
| アプリ固有のログ監視フック | 対象プロダクト専用 |
| Skill・エージェント・Workflow | プラグイン本体として配布済み。リポジトリへコピーしない |
| 言語別の実装ルール（HTML / JavaScript / Terraform / テスト等） | 採用技術に依存する。必要なリポジトリで `.claude/rules/` に追加する |

## なぜ Skill として配るのか

Claude Code のプラグインは Skill・エージェント・フック・MCP サーバーを**セッションへ読み込ませる**仕組みで、導入先リポジトリへファイルを書き出す機能は持たない。プラグインの実体は `~/.claude/plugins/cache` に置かれ、ワークツリーとは別物として扱われる。

特に `.claude/rules/`（対象ファイルを開いた時に自動適用される規約）はプラグインからは配布できない。そのため「規約ファイルをリポジトリへ置く」こと自体を Skill の仕事にしている。`references/` との使い分けは [プラグインの README](../../README.md) を参照。

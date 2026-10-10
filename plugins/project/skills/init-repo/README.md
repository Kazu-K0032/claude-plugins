# init-repo

新しいリポジトリへ「Claude Code のハーネス設定（`.claude/`）＋ GitHub の定型ファイル（`.github/`）＋ エディタ設定（`.vscode/`）・スペルチェックの設定（`cspell.json`）・`.gitignore` ＋ ドキュメントの骨組み」を一括で持ち込む Skill。実案件リポジトリの構成から、プロジェクト固有の要素を取り除いて汎用化したもの。

`files/` の中身がそのまま導入先リポジトリのルートに置かれる。

## 使い方

導入先のリポジトリのルートで Claude Code を開き、次を実行する。

```text
/project:init-repo
```

衝突状況の確認 → 計画の提示 → 承認 → コピー → エディタ設定とスペルチェックの除外語の調整、の順に進む。引数で範囲と既存ファイルの扱いを指定できる。

| 引数の例 | 動き |
| --- | --- |
| `.github だけ` / `.claude/hooks を除く` | 指定したパスで絞る |
| `必要なものだけ` | プロジェクトの構成から、要るテンプレートだけを選ぶ |
| `既存は置き換えない` | 既存ファイルに触らず、パスが違っても同じ役割のものがあればそのテンプレートは入れない |
| `docs/spec.md の要件を満たす最小限` / `<URL> の要求を満たすものは最低限` | 参照先の要件を読み、満たすのに要るテンプレートだけを入れる |

判定の基準（各テンプレートの役割・入れる条件・依存関係）は [SKILL.md](SKILL.md) の「引数の解釈」にある。既存ファイルは承認なしに上書きされない。手順の詳細は [SKILL.md](SKILL.md) を参照。

Claude を介さず手で入れる場合は、スクリプトを直接叩いてもよい（リポジトリのルートで実行する）。

```bash
bash <plugin>/scripts/install.sh --skill init-repo --check  # 状態確認だけ
bash <plugin>/scripts/install.sh --skill init-repo --apply  # 未存在のファイルだけコピー
```

## 収録物

| パス | 内容 | 導入後の調整 |
| --- | --- | --- |
| `files/.claude/settings.json` | 権限（秘匿ファイル・コミット / push・削除・権限の変更・深刻な外部操作の deny と、`*.example` の allow）とフックの設定 | 秘匿ファイルの deny パスをプロジェクトに合わせる |
| `files/.claude/hooks/guard-destructive.sh` | 破壊的コマンドを検出して承認へエスカレーションする PreToolUse フック | `patterns` にプロジェクト固有の破壊的操作を追記する |
| `files/.claude/hooks/guard-git-write.sh` | `git commit` / `git push` / `gh` 書き込みを Claude に実行させないガード（既定では未配線） | 使う場合は settings.json の PreToolUse に追加する |
| `files/.claude/hooks/post-edit-lint.sh` | 編集後に Lint を流し、結果を Claude へ返す PostToolUse フック（非ブロッキング） | 冒頭の `LINT_DIR` / `TARGET_PREFIX` と言語別ブロックを調整する |
| `files/.claude/hooks/session-start.sh` | セッション開始時に運用ルールを通知する SessionStart フック | 文言を変えるだけ |
| `files/.claude/rules/comment.md` | インラインコメントの規約（なぜを書く・読み手を選ばない言葉） | そのまま使える |
| `files/.claude/rules/env.md` | 環境変数と `*.example` の追従ルール | 変数の種類と追記先の表 |
| `files/.claude/rules/github-actions.md` | ワークフローの実装ルール（最小権限・SHA 固定・インジェクション対策） | そのまま使える |
| `files/.claude/rules/adr.md` | 判断の前に ADR の一覧を見て、新しい判断を ADR に残すか聞く規約 | ADR の置き場所が `docs/adr/` でなければパスを直す |
| `files/.claude/rules/readme.md` | README を案内板として運用するための規約 | README の種別表 |
| `files/.claude/rules/branch.md` | ブランチ名を `issues/<Issue番号>-<説明>` にし、スキルの引数などに要る Issue 番号をブランチ名から取る規約 | 名前の形が違うリポジトリでは書き換える |
| `files/.github/ISSUE_TEMPLATE/` | Issue フォーム（機能要求 / 不具合 / リファクタ / リリース / AIDD 振り返り） | `config.yml` の検証環境リンク、`release.yml` の手順 |
| `files/.github/PULL_REQUEST_TEMPLATE.md` | PR テンプレート（AI 有無で分けたチェックリスト） | ローカル確認 URL・チェック項目 |
| `files/.github/dependabot.yml` | GitHub Actions の依存更新（月次・1 PR にまとめる） | そのまま使える |
| `files/.github/labels.yml` | ラベル定義（`sync-labels.yml` が GitHub へ同期） | ラベルの追加・削除 |
| `files/.github/workflows/pr-checks.yml` | PR 差分のシークレットスキャン（gitleaks）とリポジトリ全体のスペルチェック（cspell） | そのまま使える |
| `files/.github/workflows/sync-labels.yml` | `labels.yml` を GitHub のラベルへ同期 | そのまま使える |
| `files/.vscode/extensions.json` | VS Code の推奨拡張機能（markdownlint・スペルチェック・GitHub Actions・YAML） | 技術スタックに合わせて追加する（Skill が提案する） |
| `files/.vscode/settings.json` | 保存時の整形（末尾改行・行末空白の削除・LF） | そのまま使える |
| `files/docs/adr/README.md` | ADR の一覧（`CLAUDE.md` が読み込む。表の見出しだけ） | そのまま使える |
| `files/docs/README.md` | ドキュメントの案内板（サブディレクトリの振り分け表） | 使わない行の削除・サブディレクトリ作成時のリンク追加 |
| `files/CLAUDE.md` | Claude Code 向けガイドの骨組み（禁止事項・手順ルール・SSOT 一覧・ディレクトリ） | `TODO:` 行を実態に書き換える |
| `files/README.md` | README の骨組み（リンク集約型の構成） | `TODO:` 行を実態に書き換える |
| `files/commitlint.config.mjs` | Conventional Commits の検証設定（日本語の件名前提） | 許可する type |
| `files/cspell.json` | スペルチェックの設定と除外語（VS Code の拡張機能と `pr-checks.yml` が共有する。テンプレート自身が使う語は登録済み） | プロジェクトの固有名詞を `words` に入れる（Skill が候補を出す） |
| `files/.gitignore` | Claude Code の作業ファイル（`tmp.md`・`tmp/`）・個人設定・秘匿ファイル・OS のファイルの除外 | 言語・ビルド成果物の除外を追記する |

## 前提と制約

- フックは `bash` と [`jq`](https://jqlang.org/) を使う。どちらも無い環境ではフックが失敗する
- `settings.json` の `permissions.deny` は、ルールの形に当たるコマンドしか止めない。`git -C`・`git -c` を付けたコミット・push と、`gh api` でのマージと DELETE は個別に止めている。ラッパースクリプト経由の実行まで塞ぐなら `guard-git-write.sh` を配線する
- `attribution` を空文字にしているため、コミットメッセージと PR 本文に Claude の署名行が付かない。署名を残したい場合はこのキーごと削除する
- `permissions.allow` で `*.example`（`.env.example` 等）の読み書きを明示的に許可している。秘匿ファイルの deny は実体（`.env` 等）だけを対象にしており、example は含まない。書き込みの許可は `Edit()` で書く（`Write()` のパス規則は権限判定に使われない）
- `permissions.defaultMode` とモデルは指定していない。ユーザー設定または `/config` の値が使われる
- deny は、コミット・push・削除・権限の変更と、間違えたときに深刻な外部操作（マージ・承認・リリース・ワークフローの実行など）を塞いでいる。線引きは [P1](../../../../docs/policies/p01-operation-boundary.md)。Issue・PR の作成（`gh issue create` / `gh pr create`）、コメント（`gh issue comment`）、本文・タイトル・サイドバーの更新（`gh issue edit` / `gh pr edit`）、クローズ（`gh issue close` / `gh pr close`）、Issue に紐づくブランチの作成（`gh issue develop`）は Claude に任せる前提で塞いでいない。`/aidd:issue-pr-sync` が更新に、`/aidd:issue-start` がブランチの作成・担当者の追加・確認結果のコメントに、`/config:plugin-feedback` がプラグインの不具合・改善案の起票（`Kazu-K0032/claude-plugins` への `create` / `comment`）に使う。塞ぎたい場合は deny に足す（その場合 issue-pr-sync は下書き出力まで、issue-start は確認の報告まで、plugin-feedback は Web の画面に貼る下書きを示すところまでになる）
- ファイル・ブランチ・タグ・stash の削除（`rm`・`git branch -d`・PowerShell の `Remove-Item` など）も deny で塞いでいる。作業用の一時ファイルは `tmp/<ブランチ名>/` に置き、消さずに済むようにする。消すときは人が行う
- `guard-git-write.sh` を配線すると、上記の Issue・PR の作成・更新・クローズ（`create` / `edit` / `close`）も止まる。`develop` と `comment` は止まらないため、`/aidd:issue-start` はブランチの作成と確認結果のコメントはでき、担当者の追加（`edit`）だけが止まる。`/config:plugin-feedback` は新しい Issue の作成（`create`）が止まり、下書きを Web の画面に手で貼り付ける手順に進む。配線するのは、Issue・PR の操作を人が行うと決めたリポジトリだけにする
- 既存の `README.md` に本文がある場合、Skill は本文を `docs/` 配下へ移して README を案内板に作り替えることを提案する。移動先は承認を得てから決め、本文は要約・削除しない
- `.gitignore`・`.vscode/`・`cspell.json` が既にある場合は上書きせず、足りない行・キーだけを追記する方針で手でマージする
- スペルチェックの除外語は `cspell.json` に置く。`.vscode/settings.json` の `cSpell.words` は VS Code の拡張機能しか読まず、CI の cspell には効かない
- `pr-checks.yml` のスペルチェックは、`npx` で版を固定した cspell を取得して動かす。版は `files/.github/workflows/pr-checks.yml` と、Skill の候補の洗い出しのコマンド（[SKILL.md](SKILL.md) の手順 5）の 2 か所に書いてある。版を上げるときは両方をそろえる
- `commitlint.config.mjs` は設定だけ。ESM の形式（`.mjs`）のため、`package.json` の `type` に関係なく読み込める。実行には `@commitlint/cli` と `@commitlint/config-conventional` の導入と、`commit-msg` フックの配線が要る

## 除外したもの

導入先で使い回せない、またはプロジェクト固有の前提が強いものは収録していない。

| 除外したもの | 理由 |
| --- | --- |
| Copilot 向けの指示ファイル（`.github/copilot-instructions.md`・`.github/instructions/`） | 本テンプレートは Claude Code のハーネスを対象にする |
| ビルド・テストの CI ワークフロー | 言語・フレームワーク依存。中身はプロジェクトごとに作る |
| デプロイ系ワークフロー | 配信構成（ホスティング・CDN・静的化）専用 |
| アプリ固有のログ監視フック | 対象プロダクト専用 |
| Skill・エージェント・Workflow | プラグイン本体として配布済み。リポジトリへコピーしない |
| 言語別の実装ルール（HTML / JavaScript / Terraform / テスト等） | 採用技術に依存する。技術スタック別の Skill（`/project:gas` 等）が配るか、必要なリポジトリで `.claude/rules/` に追加する |

## なぜ Skill として配るのか

Claude Code のプラグインは Skill・エージェント・フック・MCP サーバーを**セッションへ読み込ませる**仕組みで、導入先リポジトリへファイルを書き出す機能は持たない。プラグインの実体は `~/.claude/plugins/cache` に置かれ、ワークツリーとは別物として扱われる。

特に `.claude/rules/`（対象ファイルを開いた時に自動適用される規約）はプラグインからは配布できない。そのため「規約ファイルをリポジトリへ置く」こと自体を Skill の仕事にしている。`references/` との使い分けは [プラグインの README](../../README.md) を参照。

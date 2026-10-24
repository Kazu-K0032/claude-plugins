# テンプレートの収録物と要否

`init-repo` が、引数で範囲を絞るとき・同じ役割の既存物を探すとき・手順 2 で入れないものを決めるときに使う。

- [要否の判定](#要否の判定)
- [同じ役割の既存物](#同じ役割の既存物)
- [NEW でも入れないもの](#new-でも入れないもの)
- [依存関係](#依存関係)
- [要件から逆算する](#要件から逆算する)

## 要否の判定

「必要性の判定」（`必要なものだけ` など）では、「入れる条件」を満たすファイルだけを対象にする。「同じ役割の既存物」の探索にも使う。

| テンプレート | 満たす要件 | 入れる条件 | 同じ役割の既存物の例 |
| --- | --- | --- | --- |
| `.claude/settings.json` | Claude Code の権限（秘匿ファイルの deny・コミット / push・削除・権限の変更・深刻な外部操作の deny）・フックの配線と、Python のキャッシュを作らない環境変数 | Claude Code を使う（常に該当） | `.claude/settings.json` |
| `.claude/hooks/guard-destructive.sh` | 破壊的コマンドの承認エスカレーション | `settings.json` を入れる | 既存の PreToolUse フック |
| `.claude/hooks/post-edit-lint.sh` | 編集後の Lint・整形（推論と機械の検査の分担） | ソースコードがある | 既存の PostToolUse フック |
| `lefthook.yml` | Lint・整形のツールの定義（`post-edit-lint.sh` が使う）と、commitlint を呼ぶ `commit-msg` | `post-edit-lint.sh` を入れる | `lefthook.yml`・`lefthook.yaml`・`.lefthook.yml`・`.lefthook.yaml`（`claude-edit` を足す） |
| `.claude/hooks/guard-git-write.sh` | ラッパー経由まで含めた git / gh 書き込みの遮断 | 要件に明記がある場合のみ（既定では未配線） | 同等の PreToolUse フック |
| `.claude/rules/comment.md` | コメントの書き方の規約 | ソースコードがある | `CLAUDE.md`・`.claude/rules/` 内のコメント規約 |
| `.claude/rules/env.md` | 環境変数と `*.example` の追従 | `.env*` / `*.example` を使う | `CLAUDE.md` 等の環境変数の規約 |
| `.claude/rules/github-actions.md` | ワークフローの安全な書き方 | `.github/workflows/` がある、または入れる | 同等の規約 |
| `.claude/rules/readme.md` | README を案内板として運用する | `README.md` を入れる、またはドキュメントが複数ある | 同等の規約 |
| `.claude/rules/adr.md` | 判断の前に ADR の一覧を見る・判断を ADR に残すか聞く | `docs/adr/README.md` を入れる | `CLAUDE.md`・`.claude/rules/` 内の ADR の規約 |
| `.claude/rules/permissions.md` | 権限の線引き（Claude に任せる操作と人が行う操作）と、deny・フックを変えるときの決まり | `settings.json` を入れる | `CLAUDE.md`・`.claude/rules/` 内の権限の規約 |
| `.claude/rules/branch.md` | ブランチ名を Issue 番号と作業の要点にそろえる | GitHub で Issue を使う | `CLAUDE.md`・`.claude/rules/`・`CONTRIBUTING.md` 内のブランチ名の規約 |
| `.claude/rules/tmp-output.md` | `tmp/<ブランチ名>/` の置き方（スキルの出力と Claude の作業ファイルを分ける） | Claude Code を使う（常に該当） | `CLAUDE.md`・`.claude/rules/` 内の `tmp/` の規約 |
| `.claude/rules/ai-docs.md` | AI が読む文書（`SKILL.md`・規約・`CLAUDE.md`）を、人も読み切れる形で書く | Claude Code を使う（常に該当） | `CLAUDE.md`・`.claude/rules/` 内の文書の書き方の規約 |
| `.github/ISSUE_TEMPLATE/` | Issue の起票形式 | GitHub で Issue を使う | `.github/ISSUE_TEMPLATE/`・`.github/issue_template.md` |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 本文の形式 | GitHub で PR を使う | `.github/pull_request_template.md`・`docs/pull_request_template.md`・ルートの `PULL_REQUEST_TEMPLATE.md` |
| `.github/dependabot.yml` | GitHub Actions の依存更新 | `.github/workflows/` がある、または入れる | `.github/dependabot.yml`・`renovate.json`・`.github/renovate.json` |
| `.github/labels.yml` + `.github/workflows/sync-labels.yml` | ラベルのコード管理 | ラベルを運用する（Issue テンプレートを入れる場合は必須） | 既存のラベル同期ワークフロー |
| `.github/workflows/pr-checks.yml` | PR 差分のシークレットスキャン・リポジトリ全体のスペルチェック | GitHub で PR を使う | gitleaks・trufflehog・cspell 等を使う既存ワークフロー・pre-commit フック |
| `.vscode/extensions.json` / `.vscode/settings.json` | エディタの推奨拡張機能・保存時の整形 | VS Code を使う（`.vscode/` がある・チームで VS Code を使う） | `.vscode/` |
| `cspell.json` | スペルチェックの設定と除外語（VS Code の拡張機能と CI が共有する） | `pr-checks.yml` か `.vscode/` を入れる | cspell の別名の設定ファイル（`.cspell.json`・`cspell.jsonc`・`cspell.yaml`・`cspell.config.*`・`.config/cspell.*`・`.vscode/cspell.json`）・`package.json` の `cspell` キー |
| `.gitignore` | 作業ファイル・秘匿ファイルの除外 | git リポジトリ（常に該当） | `.gitignore`（据え置き時も不足行の追記は提案する） |
| `.gitattributes` | フックなどのシェルスクリプトの改行を LF に固定する | `.claude/hooks/*.sh` を入れる | `.gitattributes`（`*.sh` の改行の指定） |
| `commitlint.config.mjs` | Conventional Commits の検証 | Node.js のプロジェクトで、コミット規約を機械的に検証したい | `commitlint.config.*`・`.commitlintrc*`・`package.json` の `commitlint` キー |
| `docs/README.md` | ドキュメントの案内板 | `docs/` がある、または作る | `docs/` 以外の文書置き場（`doc/`・`documentation/`・Wiki） |
| `docs/adr/README.md` | ADR の一覧（`CLAUDE.md` が読み込む） | `CLAUDE.md` を入れる | `doc/adr/`・`docs/decisions/`・`adr/` の一覧 |
| `docs/strategies/README.md` + `ai-driven-development.md` + `development.md` + `test-strategy.md` | AI 駆動開発の戦略（AI・機械・人の分担）と、開発の流れ・テストの方針（`CLAUDE.md` の SSOT 一覧が指す） | `docs/README.md` を入れる | `CONTRIBUTING.md`・`docs/` 内の開発・テストの方針 |
| `docs/log/README.md` | 実作業の経緯を時系列で残す場所 | 手順 2 で入れると選ばれた | `docs/` 内の作業ログ・日報 |
| `CLAUDE.md` | Claude Code 向けのガイド | Claude Code を使う（常に該当） | `CLAUDE.md`・`.claude/CLAUDE.md`・`AGENTS.md` |
| `README.md` | リポジトリの入口（案内板） | 常に該当 | `README.md`・`README.*` |

## 同じ役割の既存物

`既存は置き換えない` の指定では、パスが違っても同じ役割のものが既にあるテンプレートを対象から外す。

- 上の表の「同じ役割の既存物の例」を手がかりに、Glob / Read で探す
- 見つかったら、そのテンプレートを対象から外し、手順 2 の計画で「既存の〇〇があるため入れない」と理由を添えて示す
- 判断がつかない場合（既存物が一部の役割しか果たしていない等）は、外すか入れるかを利用者に確かめる

## NEW でも入れないもの

- `commitlint.config.mjs` は `NEW` でも、ほかの commitlint の設定（`commitlint.config.*`・`.commitlintrc*`・`package.json` の `commitlint` キー）があれば入れない。前の版の `init-repo` が配った `commitlint.config.js` もこれに当たる。設定が 2 つあると、どちらが読まれるか分かりにくいため。手順 3 では `--only` でこのファイルを外してコピーする
- `lefthook.yml` も `NEW` でも、別名の設定（`lefthook.yaml`・`.lefthook.yml`・`.lefthook.yaml`）があれば入れない。両方あると lefthook は `lefthook.yml` だけを読み、既存の設定の検査が黙って止まるため。手順 3 では `--only` でこのファイルを外してコピーし、手順 5 で既存の設定に `claude-edit` を足す

## 依存関係

一方だけ入れると動かない組み合わせ。範囲を絞ったときも、片方を入れるならもう片方も入れる（既にあればよい）。

- `.claude/settings.json` は `guard-destructive.sh`・`post-edit-lint.sh` を呼ぶ。フックを外す場合は、`settings.json` の該当の `hooks` 定義も外す必要があるため、計画で明示する
- `.claude/hooks/post-edit-lint.sh` は `lefthook.yml` の `claude-edit` を動かす。`lefthook.yml` が無いと、何もしない
- `.github/workflows/sync-labels.yml` は `.github/labels.yml` を読む
- `.claude/rules/tmp-output.md` は、`.gitignore` の `tmp/` を前提にする。`tmp/` が除外されていないと、作業ファイルがコミットに混ざる
- `CLAUDE.md` の `@docs/adr/README.md` と `.claude/rules/adr.md` は、`docs/adr/README.md` を読む。入れないときは、取り込みの行と `adr.md` も外す。ADR を別の場所（`doc/adr/`・`docs/decisions/` など）に置いているときは、取り込みの行と `adr.md` のパスをその場所に直す
- `CLAUDE.md` の「SSOT 一覧」は、`docs/strategies/` の 3 つの文書（`ai-driven-development.md`・`development.md`・`test-strategy.md`）を指す。入れないときは、一覧のその行も外す。残すと、一覧が実在しない文書を指し、`/aidd:docs-sync` の SSOT 一覧の検査で落ちる
- `.github/workflows/pr-checks.yml` のスペルチェックは `cspell.json`（除外語・検査対象）を読む。無いと、テンプレート自身の語（`aidd`・`ssot` 等）も誤字として出て、PR のチェックが落ちる
- Issue テンプレートの `labels:` は `labels.yml` のラベルを前提にしている

## 要件から逆算する

引数が要件からの逆算（`docs/spec.md の要件を満たす最小限` など）のときは、次の順で対象を決める。

1. 参照先を読む。リポジトリ内のパスは Read、URL は WebFetch で読む。GitHub の Issue・PR の URL は `gh issue view` / `gh pr view` で読む（非公開リポジトリは WebFetch で読めないため）。読めなかった場合は推測で進めず、利用者に内容の貼り付けを頼む
1. 参照先から、リポジトリの設定・規約に関わる要件を箇条書きで抜き出す（例：「秘匿情報をコミットしない」「PR にテンプレートを使う」「コミットは Conventional Commits」）。アプリの機能要件など、テンプレートと無関係なものは拾わない
1. 要件ごとに、満たすテンプレートのファイルを表にする。どのファイルでも満たせない要件は「テンプレートに無い」と明記する（無理に近いファイルを当てない）
1. 表に挙がったファイルと、その依存先（上の「依存関係」）だけを対象にする

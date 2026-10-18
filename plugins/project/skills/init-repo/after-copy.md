# 導入後の残作業と、続けて使うスキル

手順 6・7 で、コピーが終わった後にユーザーへ伝えることと、続けて使う技術スタック別のスキルの聞き方をまとめる。

## 導入後にやること

1. `CLAUDE.md` / `README.md` / `.claude/rules/env.md` の `TODO:` 行を、このリポジトリの実態に書き換える（埋めたら行ごと削除する）
1. `.claude/settings.json` の `permissions.deny` を、このリポジトリの秘匿ファイル配置に合わせる
1. lefthook と、手順 5 で `lefthook.yml` に書いたツールを入れる。lefthook は npm・Homebrew・winget などで入る（[導入の方法](https://lefthook.dev/install/)）。npm で入れると、Git のフックも入る。検査の対象を絞るときは、`.claude/hooks/post-edit-lint.sh` 冒頭の `TARGET_PREFIX` を直す
1. `.claude/hooks/guard-destructive.sh` の `patterns` に、このプロジェクト固有の破壊的操作（クラウド CLI の削除系・本番ホストへの接続等）を追記する
1. `commitlint.config.mjs` を使うなら、`@commitlint/cli` と `@commitlint/config-conventional` を devDependencies に追加し、`commit-msg` フックから呼ぶ（`lefthook.yml` の `commit-msg` に書ける）
1. `.github/workflows/` には「シークレットスキャン」「スペルチェック」「ラベル同期」しか入っていない。ビルド・テストの CI はプロジェクト側で作る
1. Issue テンプレートを入れたら、`.github/ISSUE_TEMPLATE/release.yml` の「事前確認」と「リリース手順」を、このリポジトリのデプロイの方式に合わせる。テンプレートは、検証環境があり、リリース用ブランチへのマージでデプロイワークフローが動く構成を前提にしている（例：`main` へのマージでホスティングが自動でデプロイするなら、リリース用ブランチとデプロイワークフローの行をその方式の手順に置き換える）

`guard-git-write.sh` は配線していない。`git commit` / `git push` をラッパースクリプト経由まで含めて塞ぎたい場合のみ、`settings.json` の `PreToolUse` に追加するよう案内する。

## 続けて使うスキルの聞き方

ここまでは技術に依らない土台である。言語・インフラの構成と規約は、技術スタック別のスキル（このプラグインの `init-repo` 以外のスキル）が入れる。そのため、続けて使うスキルを聞く。引数がパス指定（`.github だけ` など）のときは、土台の一部を足す実行のため、聞かずに終える。

1. `${CLAUDE_PLUGIN_ROOT}/skills/*/SKILL.md` を Glob し、`init-repo` 以外の frontmatter の `name`・`description` を読む。スキルの一覧はこの本文に書かない。スキルが増えても古くならないようにするため
1. `description` が対象にする技術と、リポジトリのファイル（例：`*.tf`・`.clasp.json`・`wp-content/`）から、当てはまるスキルを判定する
1. `AskUserQuestion`（`multiSelect: true`）で聞く。選択肢はスキルと「使わない」にし、当てはまるスキルを先頭に置いてラベルに「（推奨）」を付ける。1 問の選択肢は 4 つまでのため、スキルが 3 つを超えたら問いを分ける
1. 選ばれたスキルのコマンド（`/project:<name>`）を、貼れる形で並べて示す。技術スタック別のスキルは手動でのみ呼ぶ設計（`disable-model-invocation: true`）のため、Claude は実行しない

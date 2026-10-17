# 導入後にやること

`init-repo` の手順 6 で、コピーが終わった後に、残作業として利用者に示す。

## 残作業

1. `CLAUDE.md` / `README.md` / `.claude/rules/env.md` の `TODO:` 行を、このリポジトリの実態に書き換える（埋めたら行ごと削除する）
1. `.claude/settings.json` の `permissions.deny` を、このリポジトリの秘匿ファイル配置に合わせる
1. lefthook（1.6.11 以降）と、手順 5 で `lefthook.yml` に書いたツールを入れる。lefthook は npm・Homebrew・winget などで入る（[導入の方法](https://lefthook.dev/install/)）。npm で入れると、Git のフックも入る。検査の対象を絞るときは、`.claude/hooks/post-edit-lint.sh` 冒頭の `TARGET_PREFIX` を直す
1. `.claude/hooks/guard-destructive.sh` の `patterns` に、このプロジェクト固有の破壊的操作（クラウド CLI の削除系・本番ホストへの接続等）を追記する
1. `commitlint.config.mjs` を使うなら、`@commitlint/cli` と `@commitlint/config-conventional` を devDependencies に追加し、`commit-msg` フックから呼ぶ（`lefthook.yml` の `commit-msg` に書ける）
1. `.github/workflows/` には「シークレットスキャン」「スペルチェック」「ラベル同期」しか入っていない。ビルド・テストの CI はプロジェクト側で作る
1. Issue テンプレートを入れたら、`.github/ISSUE_TEMPLATE/release.yml` の「事前確認」と「リリース手順」を、このリポジトリのデプロイの方式に合わせる。テンプレートは、検証環境があり、リリース用ブランチへのマージでデプロイワークフローが動く構成を前提にしている（例：`main` へのマージでホスティングが自動でデプロイするなら、リリース用ブランチとデプロイワークフローの行をその方式の手順に置き換える）

## 配線していないフック

`guard-git-write.sh` は配線していない。`git commit` / `git push` をラッパースクリプト経由まで含めて塞ぎたい場合のみ、`settings.json` の `PreToolUse` に追加するよう案内する。

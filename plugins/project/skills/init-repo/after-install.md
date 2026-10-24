# 導入後にやること

`init-repo` の手順 6 で、コピーが終わった後に、残作業として利用者に示す。

## 残作業

1. `CLAUDE.md` / `README.md` / `.claude/rules/env.md` / `docs/strategies/` の `TODO:` 行を、このリポジトリの実態に書き換える（埋めたら行ごと削除する）
1. `.claude/settings.json` の `permissions.deny` を、このリポジトリの秘匿ファイル配置に合わせる
1. 手順 2 で「自分で入れる」を選んだときと、Claude が入れられなかったときは、lefthook（最低の版は `README.md` の「前提と制約」）と、手順 5 で `lefthook.yml` に書いたツールを入れる。入れ方は `tooling.md` の「入れ方を決める」で決めたものを示す（[導入の方法](https://lefthook.dev/install/)）。npm で入れると、Git のフックも入る。winget で入れたときは、Claude Code を再起動してから、編集後の Lint が動くかを確かめる。検査の対象を絞るときは、`.claude/hooks/post-edit-lint.sh` 冒頭の `TARGET_PREFIX` を直す
1. `.claude/hooks/guard-destructive.sh` の `patterns` に、このプロジェクト固有の破壊的操作（クラウド CLI の削除系・本番ホストへの接続等）を追記する
1. `commitlint.config.mjs` を使うなら、`@commitlint/cli` と `@commitlint/config-conventional` を devDependencies に追加し、`lefthook install` で Git のフックを入れる。`lefthook.yml` の `commit-msg` が commitlint を呼ぶ（入っていなければ飛ばす）。`.git/` の下を書き換えるため、人が実行する
1. `.github/workflows/` には「シークレットスキャン」「スペルチェック」「ラベル同期」しか入っていない。ビルド・テストの CI はプロジェクト側で作る
1. Issue テンプレートを入れたら、`.github/ISSUE_TEMPLATE/release.yml` の「事前確認」と「リリース手順」を、このリポジトリのデプロイの方式に合わせる。テンプレートは、検証環境があり、リリース用ブランチへのマージでデプロイワークフローが動く構成を前提にしている（例：`main` へのマージでホスティングが自動でデプロイするなら、リリース用ブランチとデプロイワークフローの行をその方式の手順に置き換える）
1. 既存の `.sh` が CRLF でコミットされているときは、`.gitattributes` を入れた後に `git add --renormalize .` で LF にそろえる。LF にそろえる差分が出るため、内容を確かめてから人がコミットする。CRLF のままだと、Linux の bash でそのフックが動かない

## 配線していないフック

`guard-git-write.sh` は配線していない。`git commit` / `git push` をラッパースクリプト経由まで含めて塞ぎたい場合のみ、`settings.json` の `PreToolUse` の `"matcher": "Bash|PowerShell|Monitor"` に追加するよう案内する。

# スキルの操作と権限設定の対応

`init-repo` が配る `settings.json`（deny）・フック・`.gitignore` と、各スキルの操作の対応をまとめる。[P1](p01-operation-boundary.md) の禁止と [P4](p04-tmp-output.md) は、これらの設定で形にしている。設定がスキルの操作を止めないように、操作ごとに、何をするか・なぜか・ほかの場所でそろえることを書く。deny を自分で変えるときは、ここで影響を確かめる。

## tmp と tmp.md に書き込む

aidd の `commit`・`docs-sync`・`issue-pr-sync`・`pr-create`・`ai-report`・`pr-review`・`docs-consistency-audit` は、`tmp/<ブランチ名>/` と `tmp.md` に書き込む。[P4](p04-tmp-output.md) のため。

- そろえること：`init-repo` の `.gitignore` に `tmp/` と `tmp.md` を入れておく

## .claude/settings.local.json に書き込む

`config:plugin-feedback` は、初めての実行で `.claude/settings.local.json` の `env` に 1 行足す。承認を省く切り替え（`CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL`）を、利用者が見つけて変えられるようにするため。書き込みの条件は [P1](p01-operation-boundary.md)。

- そろえること：`init-repo` の deny に、このファイルへの書き込み（`Edit`）を入れない。`.gitignore` には入れておく。個人用の設定をコミットしないため
- 止められたとき：書き込まずに、`off` として続ける

## ~/.claude/settings.json に書き込む

`config:setup-global` は、`~/.claude/settings.json` と `~/.claude/statusline/` に書き込む。どのリポジトリでも、同じステータスラインと応答言語を使うため。

- 気をつけること：プロジェクトの `.claude/settings.json`・`settings.local.json` に同じ設定があると、そちらが優先される。スキルはそのことを利用者に伝える

## Issue を作る・コメントする

`config:plugin-feedback` は、`gh issue create` / `gh issue comment` で `Kazu-K0032/claude-plugins` に起票する。プラグインの不具合や改善案を、作者に届けるため。

- そろえること：`init-repo` の deny に入れない
- `guard-git-write.sh` を使うリポジトリでは：`create` が止まる。スキルは下書きを出し、利用者が Web の画面に貼り付ける

## Issue のブランチと担当者を用意する

`aidd:issue-start` は、`gh issue develop` / `gh issue edit` / `gh issue comment` を使う。Issue に取りかかる準備（作業用のブランチ・担当者・確認結果の記録）を済ませるため。

- そろえること：`init-repo` の deny に入れない
- `guard-git-write.sh` を使うリポジトリでは：`edit`（担当者の追加）だけが止まる

## Issue と PR の記述を更新する

`aidd:issue-pr-sync` は、`gh issue edit` / `gh pr edit` を使う。Issue と PR の記述を、実際の変更に合わせるため。

- そろえること：`init-repo` の deny に入れない
- `guard-git-write.sh` を使うリポジトリでは：反映が止まり、下書きを出すところまでになる

## コミットと push はどのスキルも実行しない

[P1](p01-operation-boundary.md) のとおり、どのスキルも `git commit` / `git push` を実行しない。`aidd:commit` も、メッセージを `tmp.md` に書くだけ。

- そろえること：`init-repo` の deny に `git commit`・`git push` を入れておく

## ファイルやブランチを消す

[P1](p01-operation-boundary.md) のとおり、どのスキルもファイル・ブランチ・タグ・stash を消さない。作業用の一時ファイルは `tmp/<ブランチ名>/` に置く。

- そろえること：`init-repo` の deny に、削除のコマンド（`rm`・`git branch -d`・`Remove-Item` など）を入れておく
- `config:mod-output-customize` を外すとき：フォルダを消すコマンドを示し、利用者に実行してもらう

## 環境変数を読む

`config` のフックと `config:plugin-feedback` は、環境変数 `CLAUDE_PLUGIN_FEEDBACK`（起票の提案を止める）と `CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL`（承認を省く）を読む。利用者が動きを切り替えられるようにするため。

- そろえること：`init-repo` の `settings.json` の `env` には入れない。利用者が自分で決める値のため

## Q&A

### Q. 新しいスキルが、`tmp/` 以外に書き込む・`gh` や `git` で書き込む・環境変数を読む

このファイルに節を足す。`init-repo` の deny・フック・`.gitignore` で止まらないか、止まったらどうなるかを書く。

### Q. `init-repo` の deny に操作を足したい

足す前に、このファイルでその操作を使うスキルを探す。止まるスキルがあれば、利用者に伝えてから決める。

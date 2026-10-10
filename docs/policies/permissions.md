# スキルの操作と権限設定の対応

`init-repo` が配る設定（deny・フック・`.gitignore`）が、各スキルの操作を止めないようにするための対応表。deny やフックを変えるときと、`tmp/` 以外に書き込むスキルを作るときに見る。線引きの考え方は [P1](p01-operation-boundary.md)。

## 対応表

| スキル | 使う操作 | `init-repo` でそろえること | `guard-git-write.sh` を使うと |
| --- | --- | --- | --- |
| `aidd` の `commit`・`docs-sync`・`issue-pr-sync`・`pr-create`・`ai-report`・`pr-review`・`docs-consistency-audit` | `tmp/<ブランチ名>/`・`tmp.md` への書き込み | `.gitignore` に `tmp/` と `tmp.md` を入れる | 止まらない |
| `config:plugin-feedback` | `.claude/settings.local.json` の `env` に 1 キーを足す | deny にこのファイルの `Edit` を入れない。`.gitignore` には入れる | 止まらない |
| `config:plugin-feedback` | `gh issue create`・`gh issue comment` | deny に入れない | `create` が止まり、下書きを Web の画面に貼る手順になる |
| `aidd:issue-start` | `gh issue develop`・`gh issue edit`・`gh issue comment` | deny に入れない | `edit`（担当者の追加と本文の更新）が止まる。本文は `tmp/` に下書きを残すところまでになる |
| `aidd:issue-pr-sync` | `gh issue edit`・`gh pr edit` | deny に入れない | 反映が止まり、下書きを出すところまでになる |
| `config` のフック・`config:plugin-feedback` | 環境変数 `CLAUDE_PLUGIN_FEEDBACK`・`CLAUDE_PLUGIN_FEEDBACK_SKIP_APPROVAL` を読む | `settings.json` の `env` に入れない（利用者が決める値のため） | 関係しない |

`config:plugin-feedback` が書き込みを止められたときは、書かずに `off` として続ける。

## Q&A

### Q. 新しいスキルが、`tmp/` 以外に書き込む・`gh` や `git` で書き込む・環境変数を読む

表に行を足す。`init-repo` の deny・フック・`.gitignore` で止まらないか、止まったらどうなるかを書く。

### Q. `init-repo` の deny やフックに操作を足したい

足す前に、この表でその操作を使うスキルを探す。止まるスキルがあれば、利用者に伝えてから決める。

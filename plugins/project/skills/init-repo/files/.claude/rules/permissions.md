---
paths:
  - ".claude/settings.json"
  - ".claude/settings.local.json"
  - ".claude/hooks/**"
---

# 権限の設定（deny・フック）に関するルール

このリポジトリでは、Claude に任せる操作と、人が行う操作を分けている。`.claude/settings.json` の `permissions.deny`（Claude が実行できない操作の一覧）とフックは、この線引きを仕組みで守るためのもの。deny やフックを足す・外すときは、この線引きに当てて決める。

## 線引きの考え方

次の順に当てて、禁止するか許可するかを決める。

1. 削除・権限の変更・コミット・push は禁止する
1. 取り消せない操作のうち、間違えたときに深刻なもの（マージ・承認・リリース・ワークフローの実行など）は禁止する
1. それ以外は許可する

| 禁止する操作 | 理由 |
| --- | --- |
| 削除 | 消したものは履歴を追えず、Claude に任せて席を外していると、消えたことに気づけないため |
| 権限の変更 | 間違えると、ほかの人やほかのサービスにまで影響が広がるため |
| コミット | 履歴に残す内容は、人が最後に確かめて決めるため。Claude がコミットすると共同作成者の行が付くことがあり、push した後は履歴を書き換えないと消せない |
| push | ほかの人へ共有するタイミングは、人が決めるため |

Issue・PR・コメント・ブランチの作成は許可している。意図しない内容ができても、消せば戻せるため。止めると、それを使うスキルが動かなくなる。

## 許可する操作と禁止する操作

| 対象 | 許可する | 禁止する |
| --- | --- | --- |
| 手元のファイル | 読み取り・作成・編集 | 削除、秘匿ファイル（`.env` など）の読み取り |
| Git | ブランチ・タグの作成、`git fetch`、`git add` | コミット、push、`git remote`、ブランチ・タグ・stash の削除、`.git/` の直接の書き換え |
| Issue・PR | 作成、コメント、本文・ラベル・担当者の更新、クローズ | 削除、マージ、レビュー（承認） |
| GitHub のそのほか | 読み取り | リリース、ワークフローの実行、リポジトリの作成・設定変更・削除、secrets・variables・鍵・ログインの変更 |
| 外部ツール | 読み取り | リモートへの反映・取り込み（`clasp push` など）、ログイン |

- `git remote` は、読み取りも止めている。変更のサブコマンドを並べると、抜けが出やすいため。リモートの URL は `gh repo view` で確かめる
- 外部ツールの禁止は、deny に入れていない。使うツールが決まったら、deny に足す。Terraform と clasp は、`/project:terraform`・`/project:gas` が配るフックで止める
- `attribution` の `commit`・`pr` を空文字にし、コミットと PR の本文に Claude の署名行を付けない。コミットの禁止を外しても、Claude の名前が履歴に残らないようにするため

## deny を足す・外す場合

- 足すときも外すときも、上の「線引きの考え方」に当てて決める
- 外すと、Claude もその操作をできるようになる。削除・コミット・push の deny を外す前に、利用者に確かめる
- 実行前の確認（許可プロンプト）を減らしたいだけなら、deny は変えず、`.claude/settings.local.json` の `permissions.allow` に足す
- 秘匿ファイルの deny（`Read(./.env)` など）は、このリポジトリの秘匿ファイルの置き場所に合わせて足す
- Terraform の秘匿ファイル（変数の値・state など）の deny は、`/project:terraform` が足す。clasp の認証情報の deny は、`/project:gas` が足す
- deny は、ルールの形に当たるコマンドしか止められない（例：`bash -c 'rm …'` は止まらない）。deny で止まらない操作も、この線引きに従う
- `Bash(...)` の規則は、PowerShell のツールには効かない。そのため、`git`・`gh` の deny は `PowerShell(...)` の形でも同じ数だけ置く。削除のコマンドは別名（`rm`・`del`・`rmdir`・`rd`・`ri`・`erase`・`Remove-Item`）も置く。足す・外すときは、`Bash(...)` と `PowerShell(...)` の組でそろえる

## フックを配線する場合

- コマンドを見るフック（PreToolUse）は、`matcher` を `Bash|PowerShell` にする。`Bash` だけだと、PowerShell のツールで打ったコマンドを見逃すため
- フックは `bash` で動くため、Git Bash の無い Windows では動かない。フックで止まらない操作も、上の線引きに従う
- `guard-git-write.sh` は、`git commit`・`git push` と、`gh` での Issue・PR などの作成・更新・クローズ・マージ・削除を止める。既定では `settings.json` に登録していない
- 登録すると、Issue・PR の作成・更新も止まり、それを使うスキル（`/aidd:issue-start` など）が途中で止まる。登録するのは、Issue・PR の操作を人が行うと決めたリポジトリだけにする
- `guard-destructive.sh` は、破壊的なコマンドを見つけて承認を求める。このプロジェクト固有の破壊的な操作は、`patterns` に足す。`patterns` は大文字小文字を区別せずに当てる。PowerShell は区別しないため
- `post-edit-lint.sh` は、編集したファイルに `lefthook.yml` の `claude-edit` をかける。`lefthook run` は既定で `.git/` の下を書き換えるため、`--no-auto-install` を付けて呼ぶ。外さない
- `guard-terraform.sh`（`/project:terraform` が配る）は、Claude が Terraform でインフラや state を変えるコマンドを止める。反映は人が行うため
- `guard-clasp.sh`（`/project:gas` が配る）は、Claude が clasp で Apps Script 側へ反映・取り込み・認証をするコマンド（`push`・`pull`・`login` など）を止める。反映は人が行うため

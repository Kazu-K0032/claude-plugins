---
name: issue-pr-sync
description: 指定した Issue（省くとブランチ名の番号）と PR（省くと今のブランチの PR）を、現在のブランチ差分とレビュー対応を踏まえて最新の内容に更新する。本文（PR 本文が空なら新規作成）・タイトル（対応内容とずれていれば直し、PR は Issue に揃える）・ラベル等のサイドバーを直接反映する（既存の記述を消すなどの重要な変更だけ、反映前に承認を取る）。追加対応やレビュー対応で Issue / PR の記述が実態とずれた時、または PR を作った直後に本文を埋めたい時に使用する
argument-hint: "[Issue番号|URL（任意。省略時はブランチ名の issues/・hotfix/ の後ろの番号。取れなければ質問する）] [PR番号|URL（任意。省略時は今のブランチの PR）]"
disable-model-invocation: true
allowed-tools: Bash(gh issue view:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh label list:*), Bash(git branch --show-current), Bash(date:*), Read, Glob, AskUserQuestion, Edit(tmp/*/issue-pr-sync/*.md)
---

# Issue / PR の同期更新

既存の Issue と PR の**根幹（背景・目的・解決方針）は正しい**前提で、そこから増えた差分を追従させる。PR 本文が空の場合は、Issue と差分から本文を新規に作る。

- 外へ書き込むもの：Issue・PR の本文・タイトル・サイドバー（ラベル・担当者・レビュワー・マイルストーン）を `gh` で直接反映する。反映前の本文と下書きは `tmp/<ブランチ名>/issue-pr-sync/` に残す
- 人がすること：承認を取る変更（既存の記述を消す・ほかの人に通知が届くなど）の可否を決める。PR 本文の「AI を使った確認」で、`/aidd:issue-pr-sync` 以外の行にチェックを入れる

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `approval.md` | 手順 4 で、承認を取る変更に当たるかを決めて聞くとき。手順 5 で、反映する対象を確かめるとき |
| `body-policy.md` | 手順 3 で、Issue・PR の本文の更新後の全文を作るとき |
| `title-and-sidebar.md` | 手順 3 で、タイトル・サイドバーの変更案を作るとき。手順 5 で、サイドバーを反映するとき |
| `errors.md` | 反映せずに終わりそうなとき（根幹が違う・更新が不要・PR が `merged` / `closed`）。変更を作らない対象があるとき |
| `final-report.md` | 手順 6 で、報告するとき |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | 手順 3 で、本文の書式を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/short-body.md` | 手順 3 で、本文の長さの上限・数え方・書き方を知るとき |
| `${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js` | 手順 3 で、本文の文字数を数えるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-check.md` | 手順 3 で、PR 本文の「AI を使った確認」を直すとき |
| `${CLAUDE_PLUGIN_ROOT}/references/pr-template.md` | 手順 3 で、PR 本文を新規作成するとき |

## 想定している引数

- `$ARGUMENTS` の 1 つ目を Issue、2 つ目を PR の識別子とする。PR だけを指定するときも、Issue を先に書く
- Issue を省いた場合は、Issue 番号をブランチ名から取る。`git branch --show-current` のブランチ名が `issues/<番号>-` か `hotfix/<番号>-` で始まれば、その `<番号>` を使う（例：`issues/36-polish-files` なら 36。`/aidd:issue-start` が作るブランチの形）。この形でなければ追加質問する
- ブランチ名から取ったときは、手順 1 で取った PR 本文の Issue への参照（`Closes #<番号>` など）と比べる。参照があるのにその番号が含まれなければ、`AskUserQuestion` でどの Issue を使うかを聞き、選ばれた Issue で `gh issue view` をやり直す。違う Issue の本文を書き換えないため
- PR を省いた場合は、今のブランチの PR を使う（`gh pr view` に識別子を渡さない）。今のブランチに PR が無ければ中断し、PR を作ってから実行するか、PR の識別子を渡すよう伝える
- 識別子は番号でも URL でもよい。`gh` は両方を受け付けるため、パースせずそのまま渡す
- `gh issue view` / `gh pr view` が失敗したら、その時点で中断して原因を報告する（存在しない・権限が無い・リポジトリが違う）

## 出力先

本文は `tmp/<ブランチ名>/issue-pr-sync/<ts>_issue.md` / `<ts>_pr.md` に書き出す。1 回の実行で 4 個まで書くため、`issue-pr-sync/` にまとめる。ブランチ名の `/` は `-` に置換する（規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。

本文を変える対象は、手順 1 で取った反映前の本文を `<ts>_issue_before.md` / `<ts>_pr_before.md` に書き出す。承認なしで反映した変更も、ここから戻せるようにするため。

## 手順

### 1. 現状を集める

今のブランチ・Issue・PR・リポジトリのラベルを集める。

```bash
git branch --show-current
date +%Y%m%d_%H%M%S
gh issue view <Issue> --json number,title,body,labels,assignees,milestone,state,url
gh pr view [<PR>] --json number,title,body,labels,assignees,milestone,reviewRequests,reviews,comments,baseRefName,state,isDraft,url
gh label list
```

PR を省いたときは `gh pr view` に識別子を渡さず、今のブランチの PR を取る。以降の `<PR>` には、ここで取った `number` を使う。

インラインのレビュースレッドは `gh pr view --json reviews` に本文が含まれないことがある。未解決の指摘を取りこぼしそうなときだけ `gh api repos/{owner}/{repo}/pulls/<PR>/comments` で補う。

PR 本文が空（空白のみを含む）なら「新規作成」、それ以外は「追従」として以降を進める。反映せずに終わる場合（根幹が違う・更新が不要・PR が `merged` / `closed`）は、`errors.md` を読む。

### 2. 差分を読む

PR のマージ先からの、コミットと差分を読む。

```bash
git log --oneline <baseRefName>..HEAD
git diff <baseRefName>...HEAD --stat
git diff <baseRefName>...HEAD
```

`baseRefName` は手順 1 の PR 情報から取る。ローカルに base ブランチが無い場合は `gh pr diff <PR>` に切り替える。

### 3. 更新案を作る

先に、今の本文を数える。500 文字を超えている対象は、ほかに直す箇所が無くても、縮める変更を作る。

```bash
gh issue view <Issue> --json body -q .body | node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" -
gh pr view <PR> --json body -q .body | node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" -
```

次の 4 つを組み立てる。

1. Issue 本文の更新後の全文（`body-policy.md`）
1. PR 本文の更新後の全文。空なら新規の本文（`body-policy.md` の「新規作成のとき」）
1. Issue / PR タイトルの変更案（`title-and-sidebar.md` の「タイトルの方針」）
1. サイドバーの変更案（`title-and-sidebar.md` の「サイドバーの更新方針」）

本文は「出力先」のファイルに書き出す。

書き出した本文を数える。超えていたら縮めて書き直し、もう一度数える。3 回直しても収まらなければ、手順 4 で超えた箇所を示す。Node.js が無い・実行を断られたときは、数えずに進み、手順 6 で伝える。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" tmp/<ブランチ名>/issue-pr-sync/<ts>_issue.md
node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" tmp/<ブランチ名>/issue-pr-sync/<ts>_pr.md
```

### 4. 重要な変更だけ承認を取る

手順 3 の変更のうち、`approval.md` の「承認を取る変更」に当たるものだけを `AskUserQuestion` で確認する。当たるものが無ければ、聞かずに手順 5 へ進む。聞き方は同じファイルの「承認を聞くとき」に従う。

### 5. 反映する

承認の要らない変更と、承認された変更を反映する。`--body` に長文を直接渡すとシェルの引用で壊れるため、本文は必ずファイル経由で渡す。

```bash
gh issue edit <Issue> --body-file tmp/<ブランチ名>/issue-pr-sync/<ts>_issue.md
gh pr edit <PR> --body-file tmp/<ブランチ名>/issue-pr-sync/<ts>_pr.md
gh issue edit <Issue> --title "<新しいタイトル>"
gh pr edit <PR> --title "<Issue のタイトル>"
```

サイドバーの反映は `title-and-sidebar.md` の「サイドバーの反映」に従う。

### 6. 報告する

反映した対象・変更前の値・文字数などを報告する。項目は `final-report.md` に従う。

## 禁止事項

- ❌ 「承認を取る変更」を、承認を取る前に反映すること
- ❌ 承認なしに、既存のラベル・担当者を外すこと
- ❌ 反映前の本文を `_before.md` に書き出す前に、本文を反映すること
- ❌ Projects を変更すること
- ❌ 既存本文の見出し・セクションを削ること
- ❌ 差分から確認できない項目にチェックを入れること（「AI を使った確認」の自分の行を除く）
- ❌ `/aidd:issue-pr-sync` 以外のコマンドの行に、チェックを入れること
- ❌ 中断したときと、承認を断られた変更があるときに、自分の行にチェックを入れること
- ❌ レビューコメントへ返信を投稿すること
- ❌ 既存の本文を全面的に書き直すこと（本文がある場合は追従であり、作り直しではない）。500 文字に縮めるときも、見出しと主張は残す
- ❌ スクリプトで数えずに、本文を反映すること（Node.js が無い・実行を断られたときを除く）
- ❌ 対応内容が変わっていないのに、タイトルを言い換えること

$ARGUMENTS

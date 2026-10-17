---
name: issue-pr-sync
description: 指定した Issue（省くとブランチ名の番号）と PR（省くと今のブランチの PR）を、現在のブランチ差分とレビュー対応を踏まえて最新の内容に更新する。本文（PR 本文が空なら新規作成）・タイトル（対応内容とずれていれば直し、PR は Issue に揃える）・ラベル等のサイドバーを直接反映する（既存の記述を消すなどの重要な変更だけ、反映前に承認を取る）。追加対応やレビュー対応で Issue / PR の記述が実態とずれた時、または PR を作った直後に本文を埋めたい時に使用する
argument-hint: "[Issue番号|URL（任意。省略時はブランチ名の issues/ の後ろの番号。取れなければ質問する）] [PR番号|URL（任意。省略時は今のブランチの PR）]"
disable-model-invocation: true
allowed-tools: Bash(gh issue view:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh label list:*), Bash(gh api:*), Bash(git log:*), Bash(git diff:*), Bash(git branch:*), Bash(date:*), Read, Glob, AskUserQuestion, Edit(tmp/*/issue-pr-sync/*.md)
---

# Issue / PR の同期更新

既存の Issue と PR の**根幹（背景・目的・解決方針）は正しい**前提で、着手後の追加対応やレビュー対応で増えた差分に、本文・タイトル・サイドバーを追従させて直接反映する。PR 本文が空なら、Issue と差分から新しく作る。

- 外へ書き込むもの：Issue・PR の本文・タイトル・サイドバー（`gh` で直接反映する）。反映する本文と反映前の本文を `tmp/<ブランチ名>/issue-pr-sync/` に書く
- 人がすること：既存の記述を消すなどの重要な変更（承認を取る変更）を承認する

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-pr-sync/errors.md` | 手順 1 で Issue・PR が取れない・PR が閉じていたとき、手順 3 で根幹が変わった・更新が要らないと判断したとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-pr-sync/body-policy.md` | 手順 3 で、本文の更新後の全文を作るとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-pr-sync/title-and-sidebar.md` | 手順 3 でタイトル・サイドバーの変更案を作るとき、手順 5 でサイドバーを反映するとき |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-check-lines.md` | 手順 3 で、PR 本文を作る・直すとき（テンプレートに「AI を使った確認」の欄があるときも） |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | 手順 3 で、本文を書くとき（markdown の書式） |
| `${CLAUDE_PLUGIN_ROOT}/references/short-body.md` | 手順 3 で、本文を書く・数えるとき（長さの上限・数え方・書き方） |
| `${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js` | 手順 3 で、本文を数えるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-pr-sync/approval-rules.md` | 手順 3・4 で、変更が承認を取るものかを決めるとき・承認を求めるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-pr-sync/result-format.md` | 手順 6 で、結果を伝えるとき |

## 想定している引数

- `$ARGUMENTS` の 1 つ目を Issue、2 つ目を PR の識別子とする。PR だけを指定するときも、Issue を先に書く
- 識別子は番号でも URL でもよい。`gh` は両方を受け付けるため、パースせずそのまま渡す
- Issue を省いた場合は、ブランチ名から取る。`git branch --show-current` のブランチ名が `issues/<番号>-` で始まれば、その `<番号>` を使う（例：`issues/36-polish-files` なら 36。`/aidd:issue-start` が作るブランチの形）。この形でなければ質問する
- ブランチ名から取ったときは、手順 1 で取った PR 本文の Issue への参照（`Closes #<番号>` など）と比べる。参照があるのにその番号が含まれなければ、`AskUserQuestion` でどの Issue を使うかを聞き、選ばれた Issue で `gh issue view` をやり直す。違う Issue の本文を書き換えないため
- PR を省いた場合は、今のブランチの PR を使う（`gh pr view` に識別子を渡さない）

## 出力先

`tmp/<ブランチ名>/issue-pr-sync/` に書く。1 回の実行で 4 個まで書くため、スキル名のフォルダにまとめる。ブランチ名の `/` は `-` に置き換える（規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。`<ts>` は手順 1 の `date` で取る。

- `<ts>_issue.md`・`<ts>_pr.md`：反映する本文
- `<ts>_issue_before.md`・`<ts>_pr_before.md`：反映前の本文。承認なしで反映した変更も、ここから戻せるようにするため

## 手順

### 1. 今の状態を集める

```bash
git branch --show-current
date +%Y%m%d_%H%M%S
gh issue view <Issue> --json number,title,body,labels,assignees,milestone,state,url
gh pr view [<PR>] --json number,title,body,labels,assignees,milestone,reviewRequests,reviews,comments,baseRefName,state,isDraft,url
gh label list
```

- PR を省いたときは `gh pr view` に識別子を渡さず、今のブランチの PR を取る。以降の `<PR>` には、ここで取った `number` を使う
- インラインのレビュースレッドは、`gh pr view --json reviews` に本文が含まれないことがある。未解決の指摘を取りこぼしそうなときだけ、`gh api repos/{owner}/{repo}/pulls/<PR>/comments` で補う
- PR 本文が空（空白のみを含む）なら「新規作成」、それ以外は「追従」として進める
- 取れなかったとき・PR が閉じていたときは、`errors.md` に従う

### 2. 差分を読む

```bash
git log --oneline <baseRefName>..HEAD
git diff <baseRefName>...HEAD --stat
git diff <baseRefName>...HEAD
```

`baseRefName` は手順 1 の PR の情報から取る。手元に base のブランチが無い場合は、`gh pr diff <PR>` に切り替える。

### 3. 更新案を作る

先に今の本文を数え、500 文字を超えている対象は、ほかに直す箇所が無くても縮める変更を作る。

```bash
gh issue view <Issue> --json body -q .body | node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" -
gh pr view <PR> --json body -q .body | node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" -
```

次の 4 つを組み立てる。本文は `body-policy.md`、タイトルとサイドバーは `title-and-sidebar.md` に従う。

1. Issue 本文の更新後の全文
1. PR 本文の更新後の全文（空なら新規の本文）
1. Issue・PR のタイトルの変更案
1. サイドバーの変更案

本文を `<ts>_issue.md`・`<ts>_pr.md` に書き出し、`short-body.md` の「確かめ方」で数える。超えていたら縮めて書き直し、もう一度数える。3 回直しても収まらなければ、手順 4 で超えた箇所を示す。Node.js が無い・実行を断られたときは、数えずに進み、手順 6 で伝える。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" tmp/<ブランチ名>/issue-pr-sync/<ts>_issue.md
node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" tmp/<ブランチ名>/issue-pr-sync/<ts>_pr.md
```

本文を変える対象は、手順 1 で取った反映前の本文を `_before.md` に書き出す。

更新が要らない対象は、無理に変更を作らず「変更なし」とする。ただし、本文が 500 文字を超えているときの縮める変更と、「AI を使った確認」の自分の行の番号・チェックの不足を直す変更は作る。全体が更新不要のときと、差分を読んで根幹（目的そのもの）が変わったと分かったとき（追従ではなく作り直しのため、その旨を報告して中断する）は、`errors.md` に従う。

### 4. 重要な変更だけ承認を取る

手順 3 の変更のうち、`approval-rules.md` の「承認を取る変更」に当たるものだけを、同じファイルの「聞き方」で `AskUserQuestion` で確かめる。当たるものが無ければ、聞かずに手順 5 へ進む。

### 5. 反映する

承認の要らない変更と、承認された変更を反映する。`--body` に長文を直接渡すとシェルの引用で壊れるため、本文は必ずファイル経由で渡す。サイドバーは、`title-and-sidebar.md` の「サイドバーの反映」のとおりまとめて反映する。

```bash
gh issue edit <Issue> --body-file tmp/<ブランチ名>/issue-pr-sync/<ts>_issue.md
gh pr edit <PR> --body-file tmp/<ブランチ名>/issue-pr-sync/<ts>_pr.md
gh issue edit <Issue> --title "<新しいタイトル>"
gh pr edit <PR> --title "<Issue のタイトル>"
```

### 6. 結果を伝える

`result-format.md` の形で伝える。

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

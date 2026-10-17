---
name: pr-create
description: 現在のブランチのコミット内容とIssue情報から、リポジトリの PR テンプレートに沿ったPR本文の下書きと、レビュワー向けの検証コメントを tmp 配下に生成する。ユーザーが PR 本文作成を求めた時に使用する
argument-hint: "[Issue番号（任意。省略時はブランチ名の issues/ の後ろの番号。取れなければ質問する）]"
disable-model-invocation: true
allowed-tools: Bash(gh issue view:*), Bash(gh pr view:*), Bash(git log:*), Bash(git diff:*), Bash(git branch:*), Bash(date:*), Read, Glob, Grep, Edit(tmp/*/pr-create_*.md), Edit(tmp/*/pr-verify_*.md)
---

# PR本文と検証コメントの作成

今のブランチのコミットと Issue から、PR テンプレートに沿った PR 本文の下書きと、レビュワーが自分の手で検証するための検証コメント（PR 本文とは別のコメント）を作る。どちらも投稿せず、`tmp/` に下書きとして書く。

- 外へ書き込むもの：`tmp/<ブランチ名>/` の PR 本文と検証コメントの下書き
- 人がすること：下書きを確かめてから、PR を作り、検証コメントを投稿する

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/references/base-branch.md` | 手順 5 で、比べるブランチを決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/pr-create/pr-body-guide.md` | 手順 7 で、PR 本文を書くとき（テンプレートの探し方・節ごとの書き方） |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-check-lines.md` | 手順 7 で、PR テンプレートに「AI を使った確認」の欄があるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/pr-create/verify-comment-template.md` | 手順 8・9 で、チェック項目を洗い出し、検証コメントを書くとき（方針・洗い出しの表・出力の形） |
| `${CLAUDE_PLUGIN_ROOT}/references/short-body.md` | 手順 7・9 で書くとき、手順 11 で数えるとき（長さの上限・数え方・書き方） |
| `${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js` | 手順 11 で、本文を数えるとき |

## 想定している引数

`$ARGUMENTS` は Issue 番号。空なら、ブランチ名から取る。`git branch --show-current` のブランチ名が `issues/<番号>-` で始まれば、その `<番号>` を使う（例：`issues/36-polish-files` なら 36。`/aidd:issue-start` が作るブランチの形）。この形でなければ質問する。番号は `gh issue view` で実在を確かめる。ブランチ名から取ったときは、報告でそのことを示す。

## 出力先

`tmp/<ブランチ名>/` に、次の 2 つを常に両方書く。ブランチ名は `git branch --show-current` で取り、`/` は `-` に置き換える（規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。

- `pr-create_<yyyymmdd_hhmmss>.md`：PR 本文
- `pr-verify_<yyyymmdd_hhmmss>.md`：検証コメント

## 手順

### 1. ブランチ名を取る

`git branch --show-current` で取る。出力のパスに使う。

### 2. タイムスタンプを取る

`date +%Y%m%d_%H%M%S` で取る。

### 3. Issue を読む

`gh issue view <Issue番号>` で、Issue のタイトル・本文・タスクを取る。`<Issue番号>` は、`$ARGUMENTS` か、ブランチ名から取った番号。

### 4. PR の番号とマージ先を取る

`gh pr view --json number,baseRefName` で、今のブランチの PR の番号とマージ先を取る。PR がまだ無ければ（コマンドが失敗したら）、番号なしで進める。

### 5. 比べるブランチを決め、コミットの一覧を取る

`base-branch.md` の「規約を探す」「今のブランチのマージ先を決める」「比べる先を最新にする」で、比べるブランチ `<base>` を決める。手順 4 で `baseRefName` が取れていれば、それがマージ先になる。続けて `git log --oneline <base>..HEAD` で、今のブランチのコミットの一覧を取る。

### 6. 変更ファイルの概要を取る

`git diff <base>...HEAD --stat` で取る。

### 7. PR 本文を書く

`pr-body-guide.md` に従い、テンプレートの節の構成に合わせて書く。本文は `## 概要` から始め、タイトルは本文に含めない。

### 8. チェック項目を洗い出す

`git diff <base>...HEAD` で差分を読み、`verify-comment-template.md` の「チェック項目の洗い出し」の表を上から全て当てて、条件分岐を挙げる。

### 9. 検証コメントを書く

`verify-comment-template.md` に従って書く。PR があれば、手順 4 で取った番号を埋める。

### 10. 2 つのファイルを書き出す

PR 本文と検証コメントを、「出力先」の 2 つのファイルに**常に両方**書き出す。

### 11. 長さを数える

`short-body.md` の「確かめ方」に従い、2 つのファイルを数える。超えていたら縮めて書き直し、もう一度数える。3 回直しても収まらなければ、超えた箇所を報告に書く。Node.js が無い・実行を断られたときは、数えずに進み、報告に書く。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" tmp/<ブランチ名>/pr-create_<yyyymmdd_hhmmss>.md
node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" --item-only tmp/<ブランチ名>/pr-verify_<yyyymmdd_hhmmss>.md
```

### 12. 報告する

2 つの出力パスと、数えた結果（数えられなかったときは、その理由）を伝える。別に、PR タイトルの案も伝える。タイトルの案は Issue のタイトルと同じ文字列にする。`/aidd:issue-pr-sync` の基準とそろえるため。

## 禁止事項

- ❌ コミットの内容と Issue の事実に無いことを、推測で書くこと
- ❌ 検証コメントを PR 本文に混ぜること（別ファイル・別用途）
- ❌ PR 本文の説明文をそのまま再掲すること（チェック項目は「確かめる操作と結果」で書く）
- ❌ マージ後にしか確認できない項目を書くこと
- ❌ CI の必須ジョブが検証済みのことを項目にすること（PR で自動的に落ちるため確認が重複する）
- ❌ テンプレートに無いセクションを足すこと
- ❌ ガード節・条件分岐を触った差分で「そうでない場合」の項目が無いまま出力すること
- ❌ チェックボックスを埋めた状態で出力すること（埋めるのはレビュワー）
- ❌ 手順 11 で数えずに報告すること（AI は文字数を正確に数えられない）。Node.js が無い・実行を断られたときを除く

$ARGUMENTS

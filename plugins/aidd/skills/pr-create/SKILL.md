---
name: pr-create
description: 現在のブランチのコミット内容とIssue情報から、リポジトリの PR テンプレートに沿ったPR本文の下書きと、レビュワー向けの検証コメントを tmp 配下に生成する。ユーザーが PR 本文作成を求めた時に使用する
argument-hint: "[Issue番号（任意。省略時はブランチ名の issues/・hotfix/ の後ろの番号。取れなければ質問する）]"
disable-model-invocation: true
allowed-tools: Bash(gh issue view:*), Bash(gh pr view:*), Bash(git branch --show-current), Bash(date:*), Read, Glob, Grep, Edit(tmp/*/pr-create_*.md), Edit(tmp/*/pr-verify_*.md)
---

# PR本文と検証コメントの作成

現在のブランチのコミット内容とIssueの情報を元に、PR 本文と検証コメントの 2 つを生成する。どちらも投稿せず `tmp/` に下書きとして出力する。

- 外へ書き込むもの：`tmp/<ブランチ名>/` の PR 本文（リポジトリの PR テンプレートに合わせた下書き）と検証コメント（レビュワーが自分の手で検証できるようにする、PR 本文とは別のコメント）。GitHub には書き込まない
- 人がすること：下書きの内容を確認して、PR の作成とコメントの投稿を行う

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `writing-guide.md` | 手順 7〜9 で、PR テンプレートを決めて PR 本文を書くとき、検証コメントのチェック項目を洗い出すとき |
| `verify-comment-template.md` | 手順 9 で、検証コメントを書くとき |
| `${CLAUDE_PLUGIN_ROOT}/references/merge-target.md` | 手順 5 で、比べるブランチ（マージ先）を決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/pr-template.md` | 手順 7 で、PR テンプレートを探すとき、無いときの節を決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-check.md` | 手順 7 で、PR 本文の「AI を使った確認」を書くとき |
| `${CLAUDE_PLUGIN_ROOT}/references/short-body.md` | 手順 7・9・11 で、本文の長さの上限・数え方・書き方を知るとき |
| `${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js` | 手順 11 で、本文の文字数を数えるとき |

## 想定している引数

- `$ARGUMENTS` が空なら、Issue 番号をブランチ名から取る。`git branch --show-current` のブランチ名が `issues/<番号>-` か `hotfix/<番号>-` で始まれば、その `<番号>` を使う（例：`issues/36-polish-files` なら 36。`/aidd:issue-start` が作るブランチの形）。報告では、番号をブランチ名から取ったことを示す
- ブランチ名がこの形でなければ、追加質問する
- `gh issue view` で番号の実在を確認する

## 出力先

出力先は `tmp/` 配下。下書きであり、PR 投稿はユーザーが内容を確認してから行う。

`tmp/<ブランチ名>/pr-create_<yyyymmdd_hhmmss>.md`（PR本文）と `tmp/<ブランチ名>/pr-verify_<yyyymmdd_hhmmss>.md`（検証コメント）を**常に両方**出力する。

## 手順

1. `git branch --show-current` で現在のブランチ名を取得する（出力パス用。`/` は `-` に置換する。規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）
2. `date +%Y%m%d_%H%M%S` でタイムスタンプを取得する
3. `gh issue view <Issue番号>` でIssueの内容（タイトル・本文・タスク）を取得する。`<Issue番号>` は、`$ARGUMENTS` か、「想定している引数」でブランチ名から取った番号
4. `gh pr view --json number,baseRefName` で今のブランチの PR の番号とマージ先を取る。PR がまだ無ければ（コマンドが失敗したら）、番号なしで進める
5. 比べるブランチ `<base>` を `merge-target.md` の順で決め、`git log --oneline <base>..HEAD` で現在のブランチのコミット一覧を取得する
   - PR があれば、手順 4 の `baseRefName` をマージ先にする
   - PR も規約も無ければ、既定ブランチ（多くは `main`）にする
6. `git diff <base>...HEAD --stat` で変更ファイルの概要を取得する
7. `writing-guide.md` の「PR テンプレートの解決」で確定したテンプレートのセクション構成に合わせてPR本文を作成する（書き方は同じファイルの「PR本文の作成方針」）。本文は `## 概要` から始め、タイトルは本文に含めない
8. `git diff <base>...HEAD` で差分本体を読み、`writing-guide.md` の「チェック項目の洗い出し」の表を上から全て当てて条件分岐を列挙する
9. `verify-comment-template.md` と、`writing-guide.md` の「検証コメントの作成方針」に従って検証コメントを作成する。PR があれば、手順 4 で取った番号を埋める
10. 「出力先」の 2 つのファイルを**常に両方**出力する
11. 2 つのファイルを数える。超えていたら縮めて書き直し、もう一度数える。3 回直しても収まらなければ、超えた箇所を報告に書く。Node.js が無い・実行を断られたときは、数えずに進み、報告に書く

    ```bash
    node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" tmp/<ブランチ名>/pr-create_<yyyymmdd_hhmmss>.md
    node "${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js" --item-only tmp/<ブランチ名>/pr-verify_<yyyymmdd_hhmmss>.md
    ```

12. 2 つの出力パス、数えた結果（数えられなかったときは、その理由）、**別途 PR タイトル案（Issue のタイトルと同じ文字列。`/aidd:issue-pr-sync` の基準と揃える）**をユーザーに報告する

## 禁止事項

- ❌ 検証コメントを PR 本文に混ぜること（別ファイル・別用途）
- ❌ PR 本文の説明文をそのまま再掲すること（チェック項目は「確かめる操作と結果」で書く）
- ❌ マージ後にしか確認できない項目を書くこと
- ❌ CI の必須ジョブが検証済みのことを項目にすること（PR で自動的に落ちるため確認が重複する）
- ❌ テンプレートに無いセクションを足すこと
- ❌ ガード節・条件分岐を触った差分で「そうでない場合」の項目が無いまま出力すること
- ❌ チェックボックスを埋めた状態で出力すること（埋めるのはレビュワー）
- ❌ 手順 11 で数えずに報告すること（AI は文字数を正確に数えられない）。Node.js が無い・実行を断られたときを除く

$ARGUMENTS

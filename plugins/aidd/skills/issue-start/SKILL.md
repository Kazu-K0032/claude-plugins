---
name: issue-start
description: 指定した Issue に着手し、実装と PR の下書きまで進める。Issue の記述を今のコード・引用元と突き合わせて確かめ、Issue に紐づく作業用のブランチを作って移動し、自分を担当者にする。関係する ADR を読み、計画モードで決めることを選択肢の質問で詰めて計画を作り、承認後に実装する。決めた仕様で Issue を更新し、決めたことを ADR にするかを聞き、実装したファイルをステージに置き、コミットメッセージを tmp.md に、PR 本文と検証コメントを tmp/ に書いて終わる。コミット・push はしない。Issue に取りかかる時に使用する
argument-hint: "<Issue番号|URL>"
disable-model-invocation: true
allowed-tools: Bash(gh issue view:*), Bash(gh repo view:*), Bash(git status:*), Bash(git branch --show-current), Bash(git branch --list *), Bash(date:*), Read, Glob, Grep, AskUserQuestion, Edit(tmp.md), Edit(tmp/*/issue-start/*.md), Edit(tmp/*/pr-create_*.md), Edit(tmp/*/pr-verify_*.md)
---

# Issue の着手

Issue の記述が今のコードと合っているかを確かめ、作業用のブランチを用意し、要件を詰めてから実装する。実装の後は、Issue の更新と、コミットメッセージ・PR の下書きまでを済ませる。

- 外へ書き込むもの：GitHub には、ブランチの作成（手順 5）・自分を担当者に足す（手順 6）・Issue の本文の更新（手順 9・13）・着手を見送った理由のコメント（ユーザーが選んだときだけ。手順 3）の 4 つだけ。ラベルと既存のコメントは変えない。ほかに `tmp.md` と `tmp/` の下書き
- 人がすること：計画の承認、コミット・push、PR の作成

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-start/issue-checks.md` | 手順 2・3 で、Issue の記述を確かめて判定するとき |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-research.md` | 手順 2 で、引用元を確かめた結果を扱うとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-start/errors.md`・`comment-template.md` | 止めるとき・コメントするとき・書き込みに失敗した（止められた）とき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-start/branch-setup.md` | 手順 4・5 で、ブランチを用意するとき |
| `${CLAUDE_PLUGIN_ROOT}/references/base-branch.md` | 手順 5 で、ブランチの規約と起点のブランチを決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-start/requirements-tree.md` | 手順 7・8 で、計画モードに入れなかったときと、要件を詰めるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-start/issue-update.md` | 手順 9・13 で、Issue の本文を書き換えるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-start/implementation.md` | 手順 10・11 で、実装して検査するとき |
| `${CLAUDE_PLUGIN_ROOT}/references/short-body.md`・`${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js` | Issue の本文・コメントを書いて数えるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/adr/SKILL.md` | 手順 2 で ADR の一覧を探すとき（「出力先」）、手順 12 で ADR にするかを聞く前と作るとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/` の `SKILL.md`・`commit-rule.md`・`output-format.md`・`split-within-file.md`・`ci-run-url.md` | 手順 14 で、コミットメッセージを作るとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/pr-create/` の `SKILL.md`・`pr-body-guide.md`・`verify-comment-template.md`、`${CLAUDE_PLUGIN_ROOT}/references/ai-check-lines.md` | 手順 15 で、PR の下書きを作るとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/issue-start/result-template.md` | 手順 16 で結果を伝えるとき、手順 3 で止めるとき |

## 想定している引数

`$ARGUMENTS` は Issue の番号か URL。空なら質問する。`gh` は両方を受け付けるため、パースせずそのまま渡す。取れない・今いるリポジトリと違うときは、`errors.md` の「中断するとき」に従う。

## 出力先

`tmp/<ブランチ名>/` の下に書く。ブランチ名の `/` は `-` に置き換える（規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。`<ts>` は `date +%Y%m%d_%H%M%S` で取る。

- `issue-start/`：書き換える前の Issue の本文（`<ts>_issue_before.md`。書き換えるたびに残す）、反映する本文（`<ts>_issue.md`）、計画モードに入れなかったときの計画（`<ts>_plan.md`）
- 直下：PR 本文と検証コメント（`pr-create_<ts>.md`・`pr-verify_<ts>.md`）。`pr-create` の出力のため、同じ場所に書く
- `work/<目的>/`：実装中の作業用の一時ファイル（手順 10）
- コミットメッセージは、`commit` と同じくプロジェクトのルートの `tmp.md` に書く

## 手順

### 1. Issue と今の状態を集める

```bash
gh issue view <Issue> --json number,title,body,state,labels,assignees,comments,closedByPullRequestsReferences,url
gh repo view --json nameWithOwner,defaultBranchRef
gh issue develop --list <Issue>
git status --porcelain
git log --oneline --all --grep "#<番号>"
```

`git log --grep` は `#1` で `#10` も拾うため、別の Issue のコミットは除いて読む。

### 2. Issue の記述を確かめる

`issue-checks.md` の「確かめること」の表を、上から全て当てる。

### 3. 判定する

`issue-checks.md` の「判定」で判定する。前提が崩れていれば、ブランチを作らずに `errors.md` に従って止める。

### 4. 作業ツリーを確かめる

`git status --porcelain` に出力があれば、ブランチを作る前に止め、`branch-setup.md` に従って扱いを聞く。

### 5. ブランチを用意する

`base-branch.md` でブランチの規約と起点のブランチを決め、`branch-setup.md` に従って、紐づいたブランチへ移動するか新しく作る。手順 15 の差分と報告でも、この起点を使う。

### 6. 自分を担当者に足す

手順 1 の担当者に自分が入っていなければ、`gh issue edit <番号> --add-assignee @me` で足す。ほかの人が入っていれば、外さずに報告の「確認の結果」に書く。

### 7. 計画モードに入る

確認の結果（判定・チェックリストに無い修正箇所・食い違い・決めることの一覧）を短く示し、`EnterPlanMode` で計画モードに入る。計画モードでは計画ファイルしか編集できないため、Issue の更新と実装は、計画の承認の後に行う。

### 8. 要件を詰めて計画を作る

`requirements-tree.md` に従い、決めることを依存関係の木にし、前提が決まった問いから回ごとに聞く。問いが尽きたら計画を書き、承認を取る。

### 9. Issue に決めた仕様を反映する

計画の承認の後、実装の前に、`issue-update.md` の手順で反映する。実装中に、Issue とコードが食い違わないようにするため。

### 10. 実装する

`implementation.md` の「実装する」に従い、計画どおりに直す。直した・作ったファイルは控えておく。

### 11. 検査する

`implementation.md` の「検査する」に従い、テスト・Lint・型検査を探して実行する。

### 12. ADR にするかを聞く

手順 8 で決めたことに ADR にできるものがあれば、`adr` の `SKILL.md` の手順 1 のとおり、`AskUserQuestion` で「作らない・極小・簡易・詳細」から選んでもらう。選ばれたものは、`adr` スキルを Skill ツールで呼んで作る（`disable-model-invocation: false` のため呼べる）。無ければ聞かずに手順 13 へ進む。

### 13. Issue のタスクを更新する

手順 9 と同じ手順（`issue-update.md`）で、実装で埋まったタスクにチェックを入れる。

### 14. ステージに置き、コミットメッセージを作る

手順 10 で控えたファイルと、手順 12 で作った ADR・一覧を `git add <ファイル>` でステージに置く。`git add -A`・`git add .` は、作業中にできたファイル（キャッシュなど）や手順 4 で持ち越した変更が混ざるため使わない。続けて `commit` の `SKILL.md` の手順で、コミットメッセージを `tmp.md` に書く。コミットはしない。

### 15. PR の下書きを作る

`pr-create` の `SKILL.md` の手順で、PR 本文と検証コメントを書く。まだコミットが無いため、コミットの一覧と差分（`git log`・`git diff <起点のブランチ>...HEAD`）の代わりに、ステージ済みの差分（`git diff --cached`）と `tmp.md` のメッセージを使う。前からのコミットがあれば、それも合わせて使う。

### 16. 結果を伝えて終わる

`result-template.md` の形で伝える。

## 禁止事項

- ❌ 前提が崩れていると判定したのに、ブランチを作ること
- ❌ 未コミットの変更があるのに、扱いを聞かずにブランチを作る・移動すること
- ❌ 起点のブランチに push していないコミットがあるのに、扱いを聞かずにブランチを作ること
- ❌ Issue のラベルや既存のコメントを変えること
- ❌ 書き換える前の本文を `tmp/` に書き出さずに、Issue の本文を書き換えること
- ❌ スクリプトで数えずに、Issue の本文を書き換える・コメントすること（Node.js が無い・実行を断られたときを除く）
- ❌ ユーザーが選んでいないのに、Issue にコメントすること
- ❌ 既存の担当者を外すこと
- ❌ 紐づいたブランチがあるのに、新しいブランチを作ること
- ❌ ブランチ名・起点のブランチを、このスキルの例やリポジトリの慣習から決め打ちすること
- ❌ 引用元で確かめていない引用を「確認済み」と書くこと
- ❌ 決めることを聞かずに、推奨案で実装すること
- ❌ 計画の承認の前に、計画ファイル以外を編集すること
- ❌ コミット・push すること
- ❌ ファイルを消すこと
- ❌ 実装と関係ないファイルをステージに置くこと

$ARGUMENTS

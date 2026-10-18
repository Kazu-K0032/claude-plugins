---
name: issue-start
description: 指定した Issue に着手し、実装と PR の下書きまで進める。Issue の記述を今のコード・引用元と突き合わせて確かめ、Issue に紐づく作業用のブランチを作って移動し、自分を担当者にする。関係する ADR を読み、計画モードで決めることを選択肢の質問で詰めて計画を作り、承認後に実装する。決めた仕様で Issue を更新し、決めたことを ADR にするかを聞き、実装したファイルをステージに置き、コミットメッセージを tmp.md に、PR 本文と検証コメントを tmp/ に書いて終わる。コミット・push はしない。Issue に取りかかる時に使用する
argument-hint: "<Issue番号|URL>"
disable-model-invocation: true
allowed-tools: Bash(gh issue view:*), Bash(gh repo view:*), Bash(git status:*), Bash(git branch --show-current), Bash(git branch --list *), Bash(date:*), Read, Glob, Grep, AskUserQuestion, Edit(tmp.md), Edit(tmp/*/issue-start/*.md), Edit(tmp/*/pr-create_*.md), Edit(tmp/*/pr-verify_*.md)
---

# Issue の着手

Issue の記述が今のコードと合っているかを確かめ、作業用のブランチを用意し、要件を詰めてから実装する。実装の後は、Issue の更新と、コミットメッセージ・PR の下書きまでを済ませる。

- 外へ書き込むもの：GitHub の Issue に次の 4 つだけ（ラベルと既存のコメントは変えない）。Issue に紐づくブランチの作成（`gh issue develop`・手順 5）、自分を担当者に足す（`gh issue edit --add-assignee @me`・手順 6）、本文の更新（`gh issue edit --body-file`・手順 9・12）、着手を見送った理由のコメント（ユーザーが選んだときだけ。`gh issue comment`・手順 3）。ほかに `tmp/<ブランチ名>/` の下書きと、`tmp.md` のコミットメッセージ
- 人がすること：計画の承認、コミット・push、PR の作成

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `checks.md` | 手順 1〜3 で、Issue の記述を確かめて判定するとき |
| `errors.md` | 前提が崩れている（手順 3）・作業ツリーに未コミットの変更がある（手順 4）とき |
| `branch.md` | 手順 5・6 で、ブランチを用意して担当者を足すとき |
| `requirements.md` | 手順 7・8 で、計画モードに入って要件を詰めるとき |
| `implementation.md` | 手順 9〜13 で、仕様の反映・実装・検査・タスクの更新・ADR を行うとき |
| `output-files.md` | `tmp/` に書くファイルの名前を確かめるとき |
| `final-report.md` | 手順 16 で報告するとき。前提が崩れているとき（手順 3）の報告にも使う |
| `comment-template.md` | 手順 3 で、着手を見送った理由を Issue にコメントするとき |
| `${CLAUDE_PLUGIN_ROOT}/references/ai-research.md` | 手順 2 で、引用元を確かめた結果を扱うとき |
| `${CLAUDE_PLUGIN_ROOT}/references/short-body.md` | 手順 3・9・12 で、Issue の本文とコメントの長さを決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/scripts/body_length.js` | 手順 3・9・12 で、本文の文字数を数えるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/adr/SKILL.md` | 手順 2 で、ADR の一覧の置き場所（「出力先」）を探すとき。手順 13 は Skill ツールで呼ぶ |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/SKILL.md` | 手順 14 で、コミットメッセージを書くとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/commit/` の `commit-rule.md`・`output-format.md`・`patch-split.md`・`ci-failure-url.md` | 手順 14 で、`commit/SKILL.md` が従わせる決まり |
| `${CLAUDE_PLUGIN_ROOT}/skills/pr-create/SKILL.md` | 手順 15 で、PR 本文と検証コメントを書くとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/pr-create/writing-guide.md` | 手順 15 で、`pr-create/SKILL.md` が従わせる書き方 |
| `${CLAUDE_PLUGIN_ROOT}/skills/pr-create/verify-comment-template.md` | 手順 15 で、`pr-create/SKILL.md` が従わせる検証コメントの形 |
| `${CLAUDE_PLUGIN_ROOT}/references/` の `merge-target.md`・`pr-template.md`・`ai-check.md` | 手順 15 で、`pr-create/SKILL.md` が従わせる決まり |

## 想定している引数

- `$ARGUMENTS` が空の場合は、Issue の番号か URL を質問する
- 識別子は番号でも URL でもよい。`gh` は両方を受け付けるため、パースせずそのまま渡す
- `gh issue view` が失敗したら、その時点で中断して原因を報告する（存在しない・権限が無い・リポジトリが違う）
- Issue の URL のリポジトリが、今いるリポジトリ（`gh repo view` の `nameWithOwner`）と違う場合は中断する。ブランチを作っても、ここでは移動できないため

## 出力先

`tmp/<ブランチ名>/` の下に書く。ブランチ名の `/` は `-` に置き換える（規約は `aidd` の `README.md` の「ブランチ名の `/` は `-` に置き換える」）。`<ts>` は `date +%Y%m%d_%H%M%S` で取る。

Issue の本文と計画は、`issue-start/` にまとめる。PR 本文と検証コメントは `pr-create` の出力のため、`pr-create` と同じく直下に書く。実装中の作業用の一時ファイルは、スキルの出力と分けて `work/<目的>/` に書く。ファイルの名前と中身は `output-files.md` に書く。

コミットメッセージは、`commit` と同じくプロジェクトのルートの `tmp.md` に書く。

## 手順

### 1. Issue と今の状態を集める

Issue・リポジトリ・紐づいたブランチ・作業ツリー・関連コミットを集める（細部は `checks.md`）。

### 2. Issue の記述を確かめる

確かめる項目を全て当て、確かめた先（ファイル・行・引用元の URL）を控える。引用元の結果は `ai-research.md` に従って扱う（細部は `checks.md`）。

### 3. 判定する

「そのまま着手してよい」「漏れ・食い違いがある」「前提が崩れている」のどれかに判定する（条件は `checks.md`、前提が崩れているときは `errors.md`）。

### 4. 作業ツリーを確かめる

未コミットの変更があれば、ブランチを作る前に止めて扱いを聞く（細部は `errors.md`）。

### 5. ブランチを用意する

紐づいたブランチがあればそこへ移動し、無ければ規約に従って作る（細部は `branch.md`）。

### 6. 自分を担当者に足す

Issue の担当者に自分が入っていなければ足す（細部は `branch.md`）。

### 7. 計画モードに入る

確認結果を短く示し、`EnterPlanMode` で計画モードに入る（細部は `requirements.md`）。

### 8. 要件を詰めて計画を作る

決めることを依存関係でつないだ木にし、今聞ける問いを回ごとにまとめて聞いて、計画を作る（細部は `requirements.md`）。

### 9. Issue に決めた仕様を反映する

計画の承認の後、実装の前に、決めた仕様で Issue の本文を更新する（細部は `implementation.md`）。

### 10. 実装する

計画どおりに直す（細部は `implementation.md`）。

### 11. 検査する

テスト・Lint・型検査を探して実行する（細部は `implementation.md`）。

### 12. Issue のタスクを更新する

実装で埋まったタスクにチェックを入れる（細部は `implementation.md`）。

### 13. ADR にするかを聞く

手順 8 で決めたことのうち ADR にできるものを、作るかを聞いてから作る（細部は `implementation.md`）。

### 14. ステージに置き、コミットメッセージを作る

1. 手順 10 で控えたファイルと、手順 13 で作った ADR・一覧を `git add <ファイル>` でステージに置く。`git add -A`・`git add .` は使わない。作業中にできたファイル（キャッシュなど）や、手順 4 で持ち越した変更を混ぜないため
1. `${CLAUDE_PLUGIN_ROOT}/skills/commit/SKILL.md` を読み、その手順でコミットメッセージを `tmp.md` に書く。コミットはしない

### 15. PR の下書きを作る

`${CLAUDE_PLUGIN_ROOT}/skills/pr-create/SKILL.md` を読み、その手順で PR 本文と検証コメントを `tmp/<ブランチ名>/` に書く。まだコミットが無いため、コミット一覧と差分（`git log`・`git diff <起点のブランチ>...HEAD`）の代わりに、ステージ済みの差分（`git diff --cached`）と `tmp.md` のメッセージを使う。ブランチに前からのコミットがあれば、それも合わせて使う。

### 16. 報告して終わる

決まった形で報告する（細部は `final-report.md`）。

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

# P8 Issue・PR の本文は、人が読み切れる形にすること

| 区分 | 内容 |
| --- | --- |
| 対象 | Issue・PR の本文とコメントを書くスキル（`aidd` の `pr-create`・`issue-start`・`issue-pr-sync`、`config:plugin-feedback`）。`project:init-repo` の PR・Issue のテンプレート。`config:mod-output-customize` の mod の「文書を簡潔に」 |
| 例外 | 検証コメント（`pr-verify`）は、上限を持たない。項目の数が差分で決まるため |
| 価値 | [V2](../values/v02-understand-before-accept.md)・[V4](../values/v04-record-reasons.md)・[V5](../values/v05-mechanisms-over-habits.md) |

冒頭の概要（最初の節）を 300 文字以内にし、概要より後の節には上限を置かない。Issue は、タスクの種類で詳しく書く節を変える。どの種類でも、書かないものを決めておく。スキルが読む写しは [references/short-body.md](../../plugins/aidd/references/short-body.md)（`config:plugin-feedback` にも同じもの）。

- 概要は、最初の節。先頭の見出しから、同じ大きさ以上の次の見出しの前まで。Issue フォームの本文では、最初の欄になる。見出しが無ければ本文全体
- 概要は、人が見える文を数える。見出し・記号も数え、HTML コメント・リンクの URL・定型の節（見出しに「チェックリスト」か「関連 Issue」を含む節）は数えない
- Issue の種類ごとに詳しく書く節：バグ修正は再現手順・期待と実際・エラーメッセージ・原因の根拠、新機能・改善は決めた要件と確かめ方、文書・版の更新は置かない（概要とタスクだけ）
- 書かないもの：調べた経緯、同じ内容の繰り返し、前置き、推測、差分を見れば分かる細部
- 書いたら、同梱のスクリプト（`body_length.js`）で概要を数える

## 理由

- 【読み手】長い本文の全体は読まれなくても、冒頭は読まれる。概要を短く保てば、人がそこで判断し、中身を分からないまま通すことを防げるから
- 【詳しく書く情報】全体の長さで切ると、再現手順・エラーメッセージ・要件のように、人や bot（Issue を読んで実装する Claude）が作業に使う情報まで削られるから
- 【種類の違い】詳しく書くべき量は、タスクの種類で違う。バグは再現と根拠、新機能は要件が要り、文書や版の更新はほとんど要らないから
- 【判断の記録】判断の理由まで削ると、あとでたどれなくなるから
- 【数える仕組み】AI は文字数を正確に数えられず、目で見て削るだけでは上限を超えるから。数えるのは、機械で決められる概要だけにする

## 変えたいとき

- mod の指示は、「文書を簡潔に」のボタンで OFF にできる
- 概要の上限の数は、下の「Q. 上限の数を変えたい」の場所をすべて直す

## Q&A

### Q. 概要が 300 文字に収まらない

目的か結論だけを残し、細部は後の節に移す。概要より後の節は数えないため、移せば収まる。

### Q. 公式ドキュメントの引用や、エラー文を載せたい

概要より後の節に、そのまま載せてよい。エラー文は要る行だけにし、引用には出典を添える。

### Q. 既存の本文の概要が、もう 300 文字を超えている

直すときに、概要を縮める。見出しは残し、中身を言い換える。概要より後の節は縮めない。既存の記述を消す変更のため、反映前に承認を取り、縮める前の本文を `tmp/` に残す。

### Q. テンプレートのチェックリストだけで長い

数えない。チェックリストと関連 Issue は、PR ごとに中身が変わらないため。テンプレートの文は変えない。

### Q. Issue の種類が分からない

タイトルと中身から一番近い種類を選び、計画や承認の画面で、どれに合わせたかを示す。リファクタリングや調査も、一番近い種類に合わせる。

### Q. PR も種類で書き分けたい

書き分けない。PR は、概要の上限と「書かないもの」だけに従う。細部は「Files changed」と、紐づく Issue で見られるため。

### Q. 上限の数を変えたい

次をすべて同じ数に直す。直したら `git grep -n -e "300 文字"` で漏れを確かめる。`commit-rule.md` の件名の目安（50 文字程度）は、別の決まりのため直さない。

- 決まりとスクリプト：`references/short-body.md` と、`body_length.js` の `SUMMARY_LIMIT`（`aidd` と `config:plugin-feedback` に 1 つずつ）
- `aidd`：`pr-create` の `pr-body-guide.md`、`issue-start` の `issue-update.md`・`requirements-tree.md`・`comment-template.md`、`issue-pr-sync` の `SKILL.md`・`approval-rules.md`・`body-policy.md`・`errors.md`、`README.md`、`references/harness-principles.md`（監査の物差し）
- `config:plugin-feedback`：`references/issue-format.md`
- mod：`hooks/register.tsx` の `DOC_CONCISE_TEXT` と、`tests/emphasis.test.tsx`
- テンプレート：`init-repo` の PR テンプレートと Issue フォーム 5 つ、このリポジトリの `.github/PULL_REQUEST_TEMPLATE.md`。`init-repo` の `README.md`（収録物の表の説明）
- このリポジトリの `.claude/skills/issue-to-pr/SKILL.md`（bot が PR 本文を数える手順）
- この方針のファイル

# P8 Issue・PR の本文は、人が読み切れる長さにすること

| 区分 | 内容 |
| --- | --- |
| 対象 | Issue・PR の本文とコメントを書くスキル（`aidd` の `pr-create`・`issue-start`・`issue-pr-sync`、`config:plugin-feedback`）。`project:init-repo` の PR・Issue のテンプレート。`config:mod-output-customize` の mod の「文書を簡潔に」 |
| 例外 | 検証コメント（`pr-verify`）は、本文全体の上限を持たない。項目の数が差分で決まるため |
| 価値 | [V2](../values/v02-understand-before-accept.md)・[V4](../values/v04-record-reasons.md)・[V5](../values/v05-mechanisms-over-habits.md) |

1 文・1 項目は 50 文字以内、本文全体は 500 文字以内で書く。スキルが読む写しは [references/short-body.md](../../plugins/aidd/references/short-body.md)（`config:plugin-feedback` にも同じもの）。

- 人が見える文を数える。見出し・記号も数え、HTML コメントとリンクの URL は数えない
- 定型の節（見出しに「チェックリスト」か「関連 Issue」を含む節）は数えない
- 詳細は書かず、処理の流れを平易に書く。技術的な内容は、引用かリンクで示す
- 判断の理由は、短くても残す
- 書いたら、同梱のスクリプト（`body_length.py`）で数える

## 理由

- 【読み手】長い本文は読まれず、人が中身を分からないまま通してしまうから
- 【詳細の置き場所】変更の細部は PR の「Files changed」で見られ、本文に写す要が無いから
- 【判断の記録】短くしても、判断の理由が消えると、あとでたどれなくなるから
- 【数える仕組み】AI は文字数を正確に数えられず、目で見て削るだけでは上限を超えるから

## 変えたいとき

- mod の指示は、「文書を簡潔に」のボタンで OFF にできる
- スキルの上限を外す切り替えは無い

## Q&A

### Q. 500 文字に収まらない

細部を削り、リンクにする。それでも収まらない大きな変更なら、Issue や PR を分ける。

### Q. 公式ドキュメントの引用や、エラー文を載せたい

引用は 1〜2 文、エラー文は要る行だけにする。どちらも 500 文字に数える。50 文字の確かめは、引用・コードブロックにはかけない。元の文を変えられないため。

### Q. 既存の本文が、もう 500 文字を超えている

直すときに、全体を縮める。見出しは残し、中身を言い換える。既存の記述を消す変更のため、反映前に承認を取り、縮める前の本文を `tmp/` に残す。

### Q. テンプレートのチェックリストだけで長い

数えない。チェックリストと関連 Issue は、PR ごとに中身が変わらないため。テンプレートの文は変えない。

### Q. 上限の数を変えたい

次をすべて同じ数に直す。直したら `git grep -n -e "500 文字" -e "50 文字"` で漏れを確かめる。`commit-rule.md` の件名の目安は、別の決まりのため直さない。

- 決まりとスクリプト：`references/short-body.md` と、`body_length.py` の `TOTAL_LIMIT`・`ITEM_LIMIT`（`aidd` と `config:plugin-feedback` に 1 つずつ）
- `aidd`：`pr-create` の `SKILL.md`・`verify-comment-template.md`、`issue-start` の `SKILL.md`・`comment-template.md`、`issue-pr-sync` の `SKILL.md`、`README.md`
- `config:plugin-feedback`：`references/issue-format.md`
- mod：`hooks/register.tsx` の `DOC_CONCISE_TEXT` と、`tests/emphasis.test.tsx`
- テンプレート：`init-repo` の PR テンプレートと Issue フォーム 5 つ、このリポジトリの `.github/PULL_REQUEST_TEMPLATE.md`
- この方針のファイル

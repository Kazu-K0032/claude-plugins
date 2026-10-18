# PR テンプレートの探し方

`pr-create` と `issue-pr-sync` が PR 本文を作るときに、節の構成を決める手順。2 つのスキルで同じ本文の形になるよう、ここを正典にする。

## 探す順

次の順に探し、最初に見つかったものを使う。

1. `.github/PULL_REQUEST_TEMPLATE.md`
1. `.github/pull_request_template.md`
1. `.github/PULL_REQUEST_TEMPLATE/*.md`
1. `docs/PULL_REQUEST_TEMPLATE.md`

## 見つからないとき

「概要 / 変更点 / 関連 Issue / チェックリスト」の 4 つの節で作り、テンプレートが無かったことを報告に書く。

- 「関連 Issue」と「チェックリスト」を必ず置く。`Closes #<番号>` とチェック項目を、本文の長さを数えない定型の節に入れるため（`short-body.md`）
- 節の見出しは、この 4 つの名前のまま使う

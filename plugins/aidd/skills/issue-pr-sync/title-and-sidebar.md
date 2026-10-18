# タイトルとサイドバーの方針

`issue-pr-sync` の手順 3 でタイトル・サイドバーの変更案を作り、手順 5 で反映するときの方針。

## タイトルの方針

- Issue のタイトルが基準。PR のタイトルは Issue のタイトルと**同じ文字列**にする
- Issue のタイトルは、対応内容が変わって**今のタイトルでは中身が伝わらない**ときだけ直す。言い回しを整えるだけの変更はしない
- 直すときは、何をするかが一読で分かる短い名詞句にする。既存の書式（日付などの接頭辞）は残す
- どちらも直す必要が無ければ「変更なし」

## サイドバーの更新方針

`gh label list` で**リポジトリに実在するラベルだけ**を使う。存在しないラベル名を提案しない。

| 項目 | 変更案を出す条件 | 反映のしかた |
| --- | --- | --- |
| ラベル | 差分の性質（バグ修正・機能追加・ドキュメント等）と現在のラベルが食い違うとき。Issue と PR で揃える | `--add-label` / `--remove-label`。外すときは承認を取る |
| 担当者 | 未設定のとき。PR は Issue の担当者に、Issue も未設定なら `@me` に揃える。設定済みなら触らない | `--add-assignee` |
| レビュワー | 未設定で、かつリポジトリに CODEOWNERS があるとき。CODEOWNERS から差分の所有者を選ぶ | `gh pr edit --add-reviewer`。通知が届くため承認を取る |
| マイルストーン | Issue に設定があり、PR が未設定のとき（Issue に揃える）。Issue も未設定なら提案しない | `gh pr edit --milestone` |
| Projects | 提案しない（`gh` の権限スコープとプロジェクトの運用に依存するため） | — |

Development セクションの Issue 紐付けは `gh` の `edit` サブコマンドでは設定できない。必要なら PR 本文の `Closes #<番号>` で代替できる旨を添え、手動での紐付けを案内するに留める。

## サイドバーの反映（手順 5）

サイドバーは反映する項目をまとめて反映する（例）。

```bash
gh issue edit <Issue> --add-label enhancement --add-assignee @me
gh pr edit <PR> --add-label enhancement --add-assignee @me --add-reviewer <ユーザー名> --milestone "<マイルストーン名>"
```

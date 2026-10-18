# タイトルとサイドバーの更新方針（issue-pr-sync）

手順 3 で、タイトル・サイドバーの変更案を作るとき、手順 5 でサイドバーを反映するときに読む。

## タイトル

- Issue のタイトルが基準。閉じる Issue が 1 つなら、PR のタイトルは Issue のタイトルと**同じ文字列**にする
- 閉じる Issue が複数（PR 本文の「関連 Issue」に `Closes #<番号>` が 2 つ以上）なら、PR のタイトルを Issue にそろえない。Release の説明は PR のタイトルの一覧のため、1 つの Issue のタイトルではほかの変更が載らない
  - ほかの Issue は、`gh issue view <番号> --json title,body` で取る。手順 1 では引数の Issue しか取らないため
  - PR のタイトルが、どれか 1 つの Issue のタイトルと同じときだけ、全ての Issue の中身が伝わる案を作る（承認を取る）
  - それ以外は変えない。人が決めたタイトルを上書きしないため
- Issue のタイトルは、対応内容が変わって**今のタイトルでは中身が伝わらない**ときだけ直す。言い回しを整えるだけの変更はしない
- 直すときは、何をするかが一読で分かる短い名詞句にする。既存の書式（日付などの接頭辞）は残す
- どちらも直す必要が無ければ「変更なし」

## サイドバー

`gh label list` で**リポジトリに実在するラベルだけ**を使う。存在しないラベル名を提案しない。

| 項目 | 変更案を出す条件 | 反映のしかた |
| --- | --- | --- |
| ラベル | 差分の性質（バグ修正・機能追加・ドキュメント等）と現在のラベルが食い違うとき。Issue と PR で揃える | `--add-label` / `--remove-label`。外すときは承認を取る |
| 担当者 | 未設定のとき。PR は Issue の担当者に、Issue も未設定なら `@me` に揃える。設定済みなら触らない | `--add-assignee` |
| レビュワー | 未設定で、かつリポジトリに CODEOWNERS があるとき。CODEOWNERS から差分の所有者を選ぶ | `gh pr edit --add-reviewer`。通知が届くため承認を取る |
| マイルストーン | Issue に設定があり、PR が未設定のとき（Issue に揃える）。Issue も未設定なら提案しない | `gh pr edit --milestone` |
| Projects | 提案しない（`gh` の権限スコープとプロジェクトの運用に依存するため） | — |

Development セクションの Issue 紐付けは、`gh` の `edit` サブコマンドでは設定できない。必要なら PR 本文の `Closes #<番号>` で代替できる旨を添え、手動での紐付けを案内するにとどめる。

## サイドバーの反映

反映する項目をまとめて反映する（例）。

```bash
gh issue edit <Issue> --add-label enhancement --add-assignee @me
gh pr edit <PR> --add-label enhancement --add-assignee @me --add-reviewer <ユーザー名> --milestone "<マイルストーン名>"
```

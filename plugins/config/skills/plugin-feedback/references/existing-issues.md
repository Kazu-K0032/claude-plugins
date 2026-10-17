# 既存の Issue の探し方と扱い

手順 3 で既存の Issue を探し、手順 4 で同じ件の Issue の状況を伝え、手順 6 で起票の形を決めるときに読む。

## 探す

語を変えて 2〜3 回検索する。語の例は、プラグイン名とスキル名・エラー文やつまずいた挙動の要点・改善案の名詞。クローズ済みも含める。

```bash
gh issue list --repo Kazu-K0032/claude-plugins --state all --search "<語>" --json number,title,state,labels,url --limit 20
```

関係がありそうな Issue は、本文とコメントまで読む。`gh issue view --comments` は端末以外から実行するとコメントしか出ないため、`--json` で取る。

```bash
gh issue view <番号> --repo Kazu-K0032/claude-plugins --json number,title,body,comments,state,stateReason,labels,assignees,updatedAt,url
```

紐づく PR は、番号で検索して探す。このリポジトリの PR は `develop` に向けるため、`Closes #<番号>` があっても Issue と PR が自動ではつながらないことがある。

```bash
gh pr list --repo Kazu-K0032/claude-plugins --state all --search "#<番号>" --json number,title,state,baseRefName,mergedAt,url
```

読んだ Issue を、「同じ件」「関連する件（同じプラグイン・スキル・テーマで、まとめて直すのが自然なもの）」「無関係」に分ける。判断に迷ったら、候補の Issue を示して `AskUserQuestion` で選んでもらう。

## 同じ件の Issue の状況

同じ件の Issue があれば、下書きを作る前に、状態ごとに次を伝える。

| 同じ件の Issue | 伝えること | その後 |
| --- | --- | --- |
| open | タイトル・URL・進み具合（担当者・ラベル・紐づく PR・最後の更新日）を示し、「同じ件が対応待ちのため、更新を待ってほしい」と伝える | 新しく分かったこと（別の再現条件・根拠など）があれば、コメントでの追記を提案する。同意されたら手順 6 へ進む（起票済みの件のため、手順 5 は飛ばす）。無い・断られたら終える |
| closed（`stateReason` が `COMPLETED`） | 直した PR を示し、直した変更がまだリリースされていないことがあると伝える。PR を `develop` に溜め、リリースでまとめて出すため | `/plugin marketplace update kazu` と `/reload-plugins` での更新を案内する。更新しても起きるなら、手順 5 へ進む。それ以外は終える |
| closed（`stateReason` が `NOT_PLANNED`・`DUPLICATE`、または `wontfix`・`duplicate`・`invalid` のラベル） | 閉じた理由を、最後のコメントとラベルからたどり、「〇〇という理由で、あえて対応していない」と伝える。重複として閉じた場合は、重複先の Issue でこの表を当て直す | `AskUserQuestion` で「それでも起票する / やめる」を聞く。起票するなら、閉じた理由を承知で求める理由をユーザーに書いてもらい、手順 5 へ進む |

閉じた理由がたどれないときは、たどれなかったことを伝え、`NOT_PLANNED` と同じく起票するかを聞く。

## 起票の形

| 既存の Issue | 形 |
| --- | --- |
| 同じ件で open（手順 4 で追記に同意された） | 新しく分かったことだけをコメントで追記する |
| 関連する件で open | コメントで追記する |
| 同じ件で closed（手順 4 で起票を続けた）・関連する件で closed | 新しい Issue を作り、本文の末尾に `関連: #<番号>` を書く |
| 無い・無関係 | 新しい Issue を作る |

判断に迷ったら、候補の Issue を示して `AskUserQuestion` で選んでもらう。

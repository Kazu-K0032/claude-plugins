# AI を使った確認を仕上げる（手順 10）

ワークフローが、レビューの直しと最後の CI の後に頼む手順。PR 本文の「AI を使った確認」のうち、docs-sync・marketplace-update・issue-pr-sync の 3 行を、点検の結果に基づいてチェックする。リポジトリのファイルは直さず、点検と Issue・PR の更新だけを行う。直しの回数は使い切っているため、ここで見つけた指摘は人に渡す。

## 渡されるもの

ワークフローは、prompt で次を渡す。

- Issue と PR の番号、記録のフォルダ（以下 `<dir>`）、点検するコミット
- レビューの直しで変わったか（`changed`）
- `body_length.js` の写しのパス。bot が動く前に取り分けたもので、作業ツリーの版は使わない

`<dir>` には、ワークフローが流した次の結果がある。

| ファイル | 中身 |
| --- | --- |
| `check-final.log` | 点検するコミットで流した `check.py` の出力 |
| `docs-sync.md` | レビューの段の docs-sync のレポート |
| `docs-sync-checks-final.log` | `changed` が true のときだけある。点検するコミットで流した docs-sync の機械チェックの出力 |

## 1. docs-sync の結果を決める

- `changed` が true なら、`plugins/aidd/skills/docs-sync/SKILL.md` の手順 3・4 を流し、レポートを `<dir>/docs-sync-final.md` に書く。手順 2 の出力には `docs-sync-checks-final.log` を使い、流し直さない。`${CLAUDE_PLUGIN_ROOT}` は `plugins/aidd` に読み替える。直しのコミットで、文書の追従が崩れていないかを確かめるため
- `changed` が false なら、`docs-sync.md` をそのまま使う
- 使うレポートの high・medium に指摘が無ければ、docs-sync の行をチェックしてよい

## 2. marketplace-update の手順 2〜6 の結果を決める

`.claude/skills/marketplace-update/SKILL.md` の手順に、次のとおり当てる。直す手順（3・4・5 の直し）は行わず、見つけたものを残った指摘とする。

- 手順 2：`check-final.log` を読む。流し直さない
- 手順 3：NG が 1 件でもあれば、残った指摘とする
- 手順 4：WARN は、`ng-warn.md` で残してよいとされた場合と、`.claude/rules/plugin-changes.md` の「既知の食い違い」に書かれた場合だけ、残っていないとみなす
- 手順 5：点検表を、`git diff origin/develop...HEAD` で確かめる。当てはまらない項目は飛ばす
- 手順 6：PR の CI（`.github/workflows/plugin-checks.yml`）が、同じコマンドを点検するコミットで流して通っている。この段は最後の CI が通ったときだけ動くため、流し直さない

残った指摘が無ければ、marketplace-update の行をチェックしてよい。

## 3. issue-pr-sync を流す

`plugins/aidd/skills/issue-pr-sync/SKILL.md` の手順 1〜5 を、Issue と PR の番号を渡したものとして流す。読み替えは次のとおり。

- `${CLAUDE_PLUGIN_ROOT}` は `plugins/aidd` に読み替える。`body_length.js` は、渡された写しのパスで動かす
- 手順 3 で PR 本文を作るとき、「AI を使った確認」の docs-sync・marketplace-update の行には、この手順の 1・2 で決めた結果のとおりにチェックを入れる。`/aidd:pr-review` の行には入れない。bot は流さないため
- 手順 4 で承認を取る変更（`approval-rules.md`）は、聞かずに反映から外し、案を記録に書く。聞ける人がいないため
- 自分の行（`/aidd:issue-pr-sync`）は、承認を取る変更が 1 つも無く、反映まで終えたときだけチェックする
- 手順 6 の代わりに、下の「4. 記録を書く」を行う

## 4. 記録を書く

`<dir>/finish.md` に、次の 3 つの節を書く。ワークフローが、PR の作業記録のコメントに載せる。見出しは `###` から始める。記録のコメントの中の節になるため。

- `### チェック`：3 行それぞれについて、チェックを入れたかと根拠（点検したコミットの短い SHA、使ったログ・レポート、結果）を 1 行ずつ書く。`ai-check-lines.md` の「行ごとの根拠」にあたる
- `### 残った指摘`：NG・残してよいもの以外の WARN・点検表の食い違い・docs-sync の high・medium。無ければ「なし」
- `### 反映しなかった変更`：承認を取る変更の案。無ければ「なし」

## 禁止事項

- リポジトリのファイルを変えない。コミット・push をしない。書き込めるのは、`tmp/` と `gh issue edit`・`gh pr edit` だけ
- 条件を満たさない行にチェックを入れない。既に入っているチェックは外さない
- 作業ツリーのスクリプト（`check.py`・`run-checks.sh`・`body_length.js`）を動かさない。実装した bot が書き換えられるため

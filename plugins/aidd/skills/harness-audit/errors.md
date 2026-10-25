# 使えないとき・止まったとき（harness-audit）

手順 1・6 で Workflow が使えないとき、手順 3 で差分が使えないとき、手順 7 で Workflow の戻り値に `stopped` があったときに読む。

## Workflow が使えないとき

指摘が 0 件だったとは伝えず、監査の前に止まったことと次の手だけを伝えて終わる。Workflow（動的ワークフロー）が切れている。

1. `/config` を開き、「Dynamic workflows」の行をオンにして、呼び直す。Pro では初期設定でオフのため、ここでオンにする
1. `/config` に行が無い、またはオンでも使えないときは、ほかの設定で切られている。次を確かめる
   - 設定ファイルの `disableWorkflows: true`
   - 環境変数 `CLAUDE_CODE_DISABLE_WORKFLOWS`。`enableWorkflows` を `true` にしても戻せない
   - 組織の管理設定。管理者に頼む
1. `/config` は端末の画面でしか開けない。VS Code の拡張とデスクトップアプリでは、`~/.claude/settings.json` に `"enableWorkflows": true` を書く

出典：[Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)（「Turn workflows off」）、[All settings](https://code.claude.com/docs/en/settings-reference)（`enableWorkflows`・`disableWorkflows`）、[Settings files and precedence](https://code.claude.com/docs/en/settings)（`/config` は端末の画面）

## 差分が使えないとき

手順 3 で差分を求められないときは、次のとおりにする。

| 場面 | 動き |
| --- | --- |
| 今のブランチが比べる先自身（`develop` など） | 差分は無いと伝え、`AskUserQuestion` で全体かディレクトリを選び直してもらい、手順 2 に戻る |
| `git fetch` を断られた | `base-branch.md` に従い、手元の `origin/<マージ先>` のまま続ける。古い可能性を手順 7 の報告に書く |
| 比べる先（`origin/<マージ先>` も手元のブランチも）が無い | 差分は使えないと伝え、全体かディレクトリを選び直してもらい、手順 2 に戻る |

## 監査の前に止まったとき

手順 7 で、Workflow の戻り値に `stopped` があれば、監査の前に止まっている。指摘が 0 件だったとは伝えず、理由と次の手だけを伝えて終わる。

| `stopped` | 伝えること |
| --- | --- |
| `not-confirmed` | 確認の印が渡っていない。手順 6 の `confirmed` を確かめて呼び直す |
| `no-files` | 対象が渡っていない。手順 3 の一覧を確かめて呼び直す |
| `too-many-agents` | 対象が多すぎる。手順 5 で「範囲を選び直す」を選び、差分かディレクトリに絞って呼び直す |
| `rubric-failed` | チェックリストを作る段が止まった。呼び直す |

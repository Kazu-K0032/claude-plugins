# 失敗した実行の URL の取り方（commit）

`commit` の手順 7 で、GitHub Actions の失敗を直すコミットに、失敗した実行の URL を添えるときに読む。

会話の経緯に失敗した実行の URL が出ていれば、それを使う（ジョブの URL なら末尾の `/job/<job_id>` を削る）。出ていなければ、今のブランチの PR のチェック結果から、失敗した GitHub Actions の実行を、ワークフロー名と URL の組で取り出す。

```bash
gh pr checks --json bucket,link,workflow -q '[.[] | select(.bucket == "fail" and .workflow != "") | "\(.workflow) \(.link | sub("/job/[0-9]+$"; ""))"] | unique | .[]'
```

- `link` は失敗したジョブの URL のため、末尾の `/job/<job_id>` を削って実行の URL にし、同じ実行は 1 つにまとめている
- `workflow` が空のチェックは GitHub Actions 以外（外部の CI・GitHub App）のため除いている
- 複数の実行が出たときは、ワークフロー名と会話の経緯から、このコミットで直した失敗の実行だけを選ぶ
- 何も出力されない、またはコマンドが失敗した（PR が無い等）ときは、URL の行を書かない。失敗の後に新しいコミットを push していると、失敗した実行が結果に出ないことがある
- 書き方（`Ref:` を 2 行に分ける・行長の上限を超えたら書かない）は、`commit-rule.md` の「CI の失敗を直すコミット」に従う

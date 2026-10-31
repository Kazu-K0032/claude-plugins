# ブランチの保護ルール

GitHub の Rulesets の定義を置く。1 ファイルが 1 つの Ruleset で、中身は [REST API](https://docs.github.com/en/rest/repos/rules) に渡す形のまま書く。

GitHub は、このフォルダのファイルを自動では読まない。ファイルを足す・変えたら、下のコマンドで人が反映する。リポジトリの設定の変更のため、Claude は反映しない（[P1](../../docs/policies/p01-operation-boundary.md)）。

## ルールの一覧

| ファイル | 対象 | 止めること |
| --- | --- | --- |
| `main.json` | `main` | 削除、force push、PR を経ない変更、merge commit 以外のマージ |
| `develop.json` | `develop` | 削除、force push。PR を経ない push は止めない（`issues/` の作業の起点で、手元の作業にも使うため）。bot（[docs/claude-bot.md](../../docs/claude-bot.md)）が履歴を書き換えるのを止める守りでもある |

## 反映する場合

初めて反映するときは作る。

```bash
gh api --method POST 'repos/{owner}/{repo}/rulesets' --input .github/rulesets/main.json
```

既にあるときは、名前から ID を調べて置き換える。

```bash
id=$(gh api 'repos/{owner}/{repo}/rulesets' --jq '.[] | select(.name == "main") | .id')
gh api --method PUT "repos/{owner}/{repo}/rulesets/$id" --input .github/rulesets/main.json
```

`gh api` は、`{owner}` と `{repo}` を今のリポジトリに置き換える。`develop` も同じで、ファイルを `develop.json`、名前を `develop` に替える。

## 画面で変えた場合

画面で変えると、このフォルダのファイルとずれる。次のコマンドで今の設定を取り出し、ファイルに反映する。

```bash
id=$(gh api 'repos/{owner}/{repo}/rulesets' --jq '.[] | select(.name == "main") | .id')
gh api "repos/{owner}/{repo}/rulesets/$id"
```

# infra

## このディレクトリは何か

インフラを Terraform で管理する場所。環境ごとの設定（`environments/`）と、環境をまたいで使う部品（`modules/`）を置く。

## いつ読むか

- インフラを足す・直すとき
- 環境ごとの違いを確かめるとき

## ファイル一覧

| ファイル | 内容 |
| --- | --- |
| [environments/stg/](environments/stg/) | 検証環境の設定 |
| [environments/prod/](environments/prod/) | 本番環境の設定 |
| [modules/](modules/README.md) | 環境をまたいで使う部品（モジュール） |
| [.gitignore](.gitignore) | Git で管理しないもの |

規約は [.claude/rules/terraform.md](../.claude/rules/terraform.md) にある。

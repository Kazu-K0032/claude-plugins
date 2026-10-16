---
paths:
  - "infra/**/*.tf"
  - "infra/**/*.tftpl"
  - "infra/**/*.tfvars.example"
docs-type: people-ai-doc
---

# Terraform の実装ルール

`infra/` の下で、インフラを Terraform で管理する。置き場所・ファイルの分け方・実行の手順をこのファイルで決める。書き方の土台は、公式の [Style Guide](https://developer.hashicorp.com/terraform/language/style) にする。

このリポジトリの固有の値は次のとおり。

| 項目 | 値 |
| --- | --- |
| Terraform のディレクトリ | `infra/` |
| 環境 | `stg`・`prod` |

## 置き場所

| 置くもの | 置き場所 |
| --- | --- |
| 環境ごとの設定（ルートモジュール。`plan` を実行する単位） | `infra/environments/<環境>/` |
| 環境をまたいで使う部品（子モジュール） | `infra/modules/<機能>/` |

- 環境ごとにディレクトリを分け、state（インフラの今の状態の記録）も環境ごとに分ける。workspace では分けない。誤った workspace で apply すると、別の環境が変わるため
- リソースは子モジュールに書き、環境の `main.tf` からは呼ぶだけにする。環境の違いは、モジュールに渡す値で出す
- 環境を足すときは、既存の環境のディレクトリを写し、`locals.tf` の `environment` と `backend.tf` の置き場所を変える

## ファイルの分け方

### ルートモジュール（`environments/<環境>/`）

| ファイル | 書くもの |
| --- | --- |
| `terraform.tf` | `required_version` と `required_providers` |
| `backend.tf` | state の置き場所（backend） |
| `providers.tf` | `provider` ブロック |
| `variables.tf` | `variable` ブロック（アルファベット順） |
| `locals.tf` | `locals` ブロック |
| `main.tf` | モジュールの呼び出しと、モジュールにしないリソース・data source |
| `outputs.tf` | `output` ブロック（アルファベット順） |

### 子モジュール（`modules/<機能>/`）

- `main.tf`・`variables.tf`・`outputs.tf` の 3 ファイルにする。大きくなったら、`main.tf` をリソースの種類ごとのファイルに分けてよい
- 1 つのモジュールには 1 つの機能だけを入れる（例：ネットワーク・データベース）。モジュールを足したら、`modules/README.md` の表に行を足す
- `provider` ブロックと backend を書かない。どちらもルートモジュールだけに書く。Ref: [Providers Within Modules](https://developer.hashicorp.com/terraform/language/modules/develop/providers)

## 変数と出力

- すべての変数に `type` と `description` を書く。`output` にも `description` を書く
- 引数は `type` → `description` → `default` → `sensitive` → `validation` の順に書く
- 省略できる変数には `default` を書く。環境ごとに変える値には書かない
- パスワード・鍵などの秘匿値には `sensitive = true` を付ける
- `validation` は、取れる値が特に限られるときだけ書く（例：環境名を `stg`・`prod` に限る）
- 名前は、中身が分かる英語の名詞を小文字で書き、語の間は `_` でつなぐ（例：`db_instance_class`）。型や単位が名前から分からないときは、末尾に付ける（例：`retention_days`）

## 秘匿値

- 変数の値（`*.tfvars`）は Git で管理しない。環境ごとの `terraform.tfvars.example` に、変数の名前と一言のコメントだけを書く
- 秘匿値でない環境ごとの値は `locals.tf` に書き、Git で管理する
- 認証情報・プロファイル名は `.tf` に書かず、環境変数などで渡す
- state と保存した plan（`tfplan`）は、秘匿値を平文で含む。Git で管理せず、ほかの場所にも写さない

## 実行

| 操作 | 誰が行うか |
| --- | --- |
| `terraform fmt`・`terraform validate`・`terraform init`・`terraform plan -out=tfplan` | Claude も行ってよい |
| `terraform workspace select`（workspace で環境を分けている既存の構成） | Claude も行ってよい。切り替える前に承認を得る |
| `terraform apply tfplan`・`destroy`・`import`・`refresh`・`taint`・`untaint`・`force-unlock`・`test`（本物のリソースを作る）・`state` の書き換え（`push`・`rm`・`mv`・`replace-provider`）・`workspace delete`・state を移す `init`（`-migrate-state`・`-force-copy`） | 人が行う |

- plan は `-out=tfplan` で保存し、apply は保存した plan ファイルだけを渡す。人が確かめた内容だけを反映するため
- Claude は plan の結果（作る・変える・消すリソース）を示して、人に apply を頼む。消える・作り直されるリソースは、特に目立たせる
- `-target` を使わない。一部だけを反映すると、設定と実際のずれに気づけなくなるため。復旧などの例外の場面では、人が判断して実行する
- `.claude/hooks/guard-terraform.sh` が、上の決まりに反する Claude のコマンドを止める

## check ブロック

- apply を止めずに、作った後の状態を確かめたいときに書く（例：証明書の期限・公開した URL の応答）。失敗しても警告が出るだけで、apply は止まらない
- 満たさないと作ってはいけない条件は、`check` ではなく、リソースの `precondition`・`postcondition` に書く。こちらは失敗すると止まる

## テンプレート（`.tftpl`）

- `templatefile` で読むファイルの拡張子は `.tftpl` にする
- 中身に文字どおりの `${` を書くときは `$${`、`%{` を書くときは `%%{` と書く。そのまま書くと、Terraform の式として読まれる（例：シェルスクリプトの `${HOME}` は `$${HOME}`）

## コメント

- コメント記号は `#` を使う。`//` も動くが、慣例ではないため
- Terraform に慣れていない人も読めるよう、`.tf` には「何をしているか」のコメントも書いてよい（`.claude/rules/comment.md` の「なぜだけを書く」の例外）

## 整形と検査

- `.tf` を直したら `terraform fmt` で整え、コミットの前に `terraform validate` を通す
- `.terraform.lock.hcl`（プロバイダの版の記録）はコミットする。全員が同じ版を使うため

# terraform

Terraform でインフラを管理するリポジトリへ「`infra/` 配下の構成（環境ごとの設定と modules）＋ 置き場所と実装の規約 ＋ Claude に apply などをさせないフック」を持ち込む Skill。

`files/` の中身がそのまま導入先リポジトリのルートに置かれる。

## 使い方

導入先のリポジトリのルートで Claude Code を開き、次を実行する。`.claude/settings.json`（土台）が無ければ、先に `/project:init-repo` を実行するかを Skill が聞く。

```text
/project:terraform
```

衝突状況の確認 → 計画の提示 → 承認 → コピー → 衝突の片付け → フックと deny の登録 → Lint のフックへの追加、の順に進む。

| 引数の例 | 動き |
| --- | --- |
| `規約だけ` | `.claude/rules/terraform.md` だけを入れる |
| `フックだけ` | `.claude/hooks/guard-terraform.sh` だけを入れ、`.claude/settings.json` にフックと deny を登録する |
| `既存は置き換えない` | 既存ファイルに触らない |

既に `.tf` がある場合は、ファイルを動かさず、規約とフックだけを入れて、規約を今の構成に合わせる。手順の詳細は [SKILL.md](SKILL.md) を参照。

Claude を介さず手で入れる場合は、スクリプトを直接叩いてもよい（リポジトリのルートで実行する）。フックの登録は手で行う。

```bash
bash <plugin>/scripts/install.sh --skill terraform --check  # 状態確認だけ
bash <plugin>/scripts/install.sh --skill terraform --apply  # 未存在のファイルだけコピー
```

## 収録物

| パス | 内容 | 導入後の調整 |
| --- | --- | --- |
| `files/.claude/rules/terraform.md` | 置き場所・ファイルの分け方・変数と出力・秘匿値・実行の手順（Claude は plan まで）・`check` ブロック・`.tftpl` のエスケープ・コメントの規約 | そのまま使える（既存の構成に入れたときは、Skill が場所を合わせる） |
| `files/.claude/hooks/guard-terraform.sh` | Claude がインフラや state を変えるコマンド（apply・destroy・`test`・`workspace delete` など。一覧は規約の「実行」）と、`-out` の無い plan・`-target` を止める PreToolUse フック。`workspace select` は承認を求める | 止めるコマンドを足すときは `deny_patterns` に追記する |
| `files/infra/README.md` | `infra/` の案内板 | 環境を足したら行を足す |
| `files/infra/.gitignore` | `.terraform/`・state・保存した plan・変数の値（`*.tfvars`）の除外 | そのまま使える |
| `files/infra/modules/README.md` | modules の案内板 | モジュールを足したら行を足す |
| `files/infra/environments/stg/` | 検証環境のルートモジュール（`terraform.tf`・`backend.tf`・`providers.tf`・`variables.tf`・`locals.tf`・`main.tf`・`outputs.tf`・`terraform.tfvars.example`） | `terraform.tf`・`backend.tf`・`providers.tf` の `TODO:` に、使うクラウドのプロバイダと backend を書く |
| `files/infra/environments/prod/` | 本番環境のルートモジュール（中身は stg と同じで、環境名だけが違う） | stg と同じ |

## 前提と制約

- クラウドは決めていない。プロバイダと backend は `TODO:` のコメントだけで、書くまでは state が手元にできる
- 環境はディレクトリで分け、workspace は使わない前提にしている。誤った workspace で apply すると、別の環境が変わるため
- 利用先の Claude が実行してよいのは、fmt・validate・init・`plan -out=tfplan` まで。apply・destroy・state の書き換えは人が行う（[P1](../../../../docs/policies/p01-operation-boundary.md)）。`guard-terraform.sh` はこれを仕組みで守る
- フックは `settings.json` の PreToolUse に登録して初めて効く。`settings.json` が無いリポジトリでは Skill は作らず、登録の定義を伝える
- 秘匿ファイル（`*.tfvars`・`*.tfstate`・`.terraform/`）の読み取りの deny は、Skill が `settings.json` に足す。Terraform を使うリポジトリにだけ要るため、`/project:init-repo` には含めない（[P6](../../../../docs/policies/p06-common-template.md)）
- `terraform` のコマンドは、Skill は実行しない（人が行う）。認証情報・state・実際のインフラに触れるため

## 除外したもの

| 除外したもの | 理由 |
| --- | --- |
| プロバイダと backend の具体的な設定 | 使うクラウドと、state の置き場所がプロジェクトごとに違う |
| 例のモジュール | 中身がプロジェクトごとに違う。クラウドを決めないため、何も作らない例になり、使うときに消す手間がかかる |
| 各サービスのモジュール・プロファイル名・秘匿情報の管理方式・実行基盤の ADR | 元にしたプロジェクトの固有のもの |
| fmt・validate・plan の CI ワークフロー | 実行基盤とクラウドの認証の方式で、中身が変わる |
| `terraform validate` を Lint のフックで動かす設定 | `terraform init` 済みのディレクトリでしか動かず、モジュールのファイルでは、どの環境で検査するかが決まらない |

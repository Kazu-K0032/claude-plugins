# 導入後にやること

`SKILL.md` の手順 9 で、ユーザーに提示する残作業。コマンドは人が実行する。

1. 各環境の `terraform.tf`・`backend.tf`・`providers.tf` の `TODO:` に、使うクラウドのプロバイダと backend を書く。backend を書くまでは apply しない。state が手元にでき、共有できないため
1. 各環境のディレクトリで `terraform init` を実行し、できた `.terraform.lock.hcl` をコミットする
1. 反映するときは、`terraform plan -out=tfplan` の結果を確かめてから、`terraform apply tfplan` を実行する
1. `CLAUDE.md` があれば、「ディレクトリ」に `infra/` を足す。ルートの `README.md` から `infra/README.md` へ案内する
1. 手順 6 でフックと deny を登録しなかった場合は、`.claude/settings.json` に手順 6 の定義を足す（`/project:init-repo` で土台を入れてからでもよい）
1. 手順 6 で `guard-destructive.sh` に古い Terraform のブロックや `patterns` の行が見つかった場合は、`guard-terraform.sh` と重なるため、消してよい
1. 手順 7 でフックに足さなかった場合は、`terraform fmt` をフックで動かすかを決める
1. 手順 7 で、古い形のフックのまま `lefthook.yml` に足した場合は、`/project:init-repo` を実行して `post-edit-lint.sh` を上書きする。上書きするまで、足した定義は動かない
1. 手順 4 で規約のまま残した違いがあれば、構成を直すかを決める

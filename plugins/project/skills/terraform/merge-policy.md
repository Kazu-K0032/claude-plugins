# 衝突したファイルのマージ方針

`terraform` の手順 5 で、`DIFF` のファイルがあるとき、上書き / 手でマージ / 据え置きを選んでもらう前に読む。ファイルごとの「上書きしない」「既存を正とする」は、選択肢を示すときに伝える。

| ファイル | マージ方針 |
| --- | --- |
| `.claude/rules/terraform.md` | 既存の規約に足りない項目だけを足す |
| `.claude/hooks/guard-terraform.sh` | 既存を正とする。止めるコマンドが足りなければ、`deny_patterns` に足すことを提案する |
| `infra/.gitignore` | 足りない行だけを足す |
| `infra/README.md`・`infra/modules/README.md` | 既存の一覧に、足したファイルの行だけを足す |
| `infra/environments/` の `.tf`・`terraform.tfvars.example` | 上書きしない |

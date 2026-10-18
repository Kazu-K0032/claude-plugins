# 既存の構成・ファイルとの調整

`SKILL.md` の手順 4・5 の細部。既存の `.tf` がある（B の場合）、または `DIFF` のファイルがあるときに読む。

## 今の構成に合わせる

コピーした `.claude/rules/terraform.md` の、frontmatter の `paths`、冒頭の固有の値の表、「ファイルを置く場合」の表と、`infra/` で始まるパスを、今の構成の場所に書き換える。

今の構成が規約と違う点（workspace で環境を分けている・ファイルの分け方が違うなど）は一覧にし、`AskUserQuestion` で扱いを聞く。`.tf` は変えない。

| 選択肢 | 扱い |
| --- | --- |
| 規約を今の構成に合わせる | 規約の該当の行を、今の構成の書き方に書き換える |
| 規約のまま残す | 規約は変えず、構成を直すかは手順 9 で利用者に任せる |

## 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/terraform/files/<同じ相対パス>"
```

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `.claude/rules/terraform.md` | 既存の規約に足りない項目だけを足す |
| `.claude/hooks/guard-terraform.sh` | 既存を正とする。止めるコマンドが足りなければ、`deny_patterns` に足すことを提案する |
| `infra/.gitignore` | 足りない行だけを足す |
| `infra/README.md`・`infra/modules/README.md` | 既存の一覧に、足したファイルの行だけを足す |
| `infra/environments/` の `.tf`・`terraform.tfvars.example` | 上書きしない |

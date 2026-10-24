# 衝突したファイルのマージ方針

`init-repo` の手順 4 で、`DIFF` のファイルがあるとき、上書き / 手でマージ / 据え置きを選んでもらう前に読む。既存の `CLAUDE.md` があるときも使う。

## CLAUDE.md

- テンプレートの見出し構成に、既存の記述を差し込む形でマージするのが基本。既存の内容を捨てない
- 既存の `CLAUDE.md` に `docs-type` の節（「`.claude/` ファイルのメタデータ規約」）があれば、選んだ扱いや `既存は置き換えない` の指定に関わらず、外すことを提案する。前の版が配った節で、AI 向けの文書は人が読めなくてよいとしており、`.claude/rules/ai-docs.md` と食い違うため

## ファイル別の方針

| ファイル | マージ方針 |
| --- | --- |
| `README.md` | 案内板に作り替える（下の「README.md を案内板にする」） |
| `.gitignore` | 既存の行は残し、テンプレートにあって既存に無い行だけを末尾へ追記する。`既存は置き換えない` の指定があっても、不足行の追記は提案する |
| `.gitattributes` | 既存の行は残し、`*.sh` の指定が無いときだけ末尾へ追記する。`*.sh` に別の指定（`eol=crlf` など）があれば、追記せず利用者に伝える。2 つの指定が並ぶと、後の行が効いて LF にならないため |
| `.vscode/settings.json` / `.vscode/extensions.json` | 既存のキー・配列要素は残し、無いものだけを足す。JSONC（コメント・末尾カンマ）を壊さない。既存の `cSpell.words` は cspell の CLI が読まないため、`cspell.json` の `words` へ移すことを提案する |
| `cspell.json` | 既存のキー・`words` の語は残し、無いものだけを足す |
| `.claude/settings.json` | 既存のキー・配列要素は残し、無いものだけを足す。`env` の `PYTHONDONTWRITEBYTECODE` も足す。`hooks.PreToolUse` の `"matcher": "Bash"`・`"Bash\|PowerShell"` は、`"Bash\|PowerShell\|Monitor"` に直す案を示す。足りないと PowerShell・`Monitor` のツールに効かず、別の定義として足すと同じフックが 2 つ並ぶため |
| `lefthook.yml` | 既存のフック（`pre-commit` など）は残し、`claude-edit` が無ければ足す。`commit-msg` が無ければ、commitlint を呼ぶ `commit-msg` も足す案を示す。名前の違う設定（`.lefthook.yml` など）があれば、そちらに足す |

## README.md を案内板にする

README は「どこに何があるか」を示す案内板として扱う（`.claude/rules/readme.md`）。既存の README に本文（環境構築の手順・設計の説明・API の説明など）がある場合は、次の順で作り替える。

1. 既存 README の見出しごとに、移動先の候補を表で提示する（例：環境構築 → `docs/runbook/environment-setup.md`、設計 → `docs/architecture/architecture.md`）。移動先は `docs/README.md` の振り分け表に従う
1. 利用者の承認を得てから、本文を移動先へそのまま移す（要約・削除しない）。移動先のサブディレクトリを新しく作る場合は、同時にその `README.md`（案内板）も置く
1. ルートの `README.md` はテンプレートの構成に合わせる。移した本文へのリンクは、ルートではなく移動先の案内板（`docs/README.md` やサブディレクトリの `README.md`）に置き、ルートからは `docs/README.md` だけを案内する。概要（1〜2 行）・各環境のリンク・外部リンクなど、リンク集として残せる情報はそのまま残す

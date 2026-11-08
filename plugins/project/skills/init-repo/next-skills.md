# 続けて使うスキルの聞き方

`init-repo` の手順 7 で、技術スタック別のスキル（このプラグインの `init-repo` 以外）から、続けて使うものを聞くときに使う。

## 聞く

1. このプラグインの `skills/*/SKILL.md` を Glob し、`init-repo` 以外の frontmatter の `name`・`description` を読む。プラグインの場所は、`SKILL.md` の「参照ファイル」の表にあるパスの、`skills/` より前の部分にする
1. `description` が対象にする技術と、リポジトリのファイル（例：`*.tf`・`.clasp.json`・`wp-content/`）から、当てはまるスキルを判定する
1. `AskUserQuestion`（`multiSelect: true`）で聞く。選択肢はスキルと「使わない」にし、当てはまるスキルを先頭に置いてラベルに「（推奨）」を付ける。1 問の選択肢は 4 つまでのため、スキルが 3 つを超えたら問いを分ける
1. 選ばれたスキルのコマンド（`/project:<name>`）を、貼れる形で並べて示す。技術スタック別のスキルは手動でのみ呼ぶ設計（`disable-model-invocation: true`）のため、Claude は実行しない

## 保守

- この文書に、スキルの一覧を書かない。スキルが増えても古くならないようにするため

# 先に init-repo を入れるかを聞く

技術スタック別のスキル（`gas`・`wordpress`・`terraform`）が、手順 1 の最初に使う。土台（`/project:init-repo`）は必須ではないが、無いと入らないものがあるため、先に入れるかを聞く。

## 土台を確かめる

土台の `.claude/settings.json` があるかを Glob で確かめる。あれば、そのまま進める。無ければ、`AskUserQuestion` で聞く。

| 選択肢 | 次の動き |
| --- | --- |
| 先に init-repo を実行する（推奨） | ここで止め、`/project:init-repo` を実行してから、使っているスキル（`/project:<スキル名>`）を呼び直すよう案内する。どちらも Claude からは呼べないため、利用者が実行する |
| このまま進める | 下の表の影響を伝えて続ける |

## このまま進めたときの影響

| スキル | 伝える影響 |
| --- | --- |
| `gas` | フック（`guard-clasp.sh`）と認証情報の deny を登録できない。秘匿ファイルの deny・破壊的な操作を止めるフック・`CLAUDE.md` などの土台も入らない |
| `wordpress` | `lefthook.yml` も無ければ、PHP の Lint をフックで動かせない（Lint の設定と規約は入る）。`guard-destructive.sh` も無ければ、`docker compose down -v` を止められない。秘匿ファイルの deny も入らない |
| `terraform` | フック（`guard-terraform.sh`）と秘匿ファイルの deny を登録できない。`lefthook.yml` も無ければ、`terraform fmt` をフックで動かせない |

# 現状の確認

手順 1 で、土台・`--check` のラベル・既存の WordPress を調べ、導入の状態（A・B・C）を決めるときに読む。

## 土台が無い場合

`.claude/settings.json`・`CLAUDE.md` などの土台（`/project:init-repo`）は必須ではない。無ければ手順 1 で、先に入れるかを聞く。土台の `lefthook.yml`（古い形では `.claude/hooks/post-edit-lint.sh`）があれば手順 8 で PHP の Lint を、`.claude/hooks/guard-destructive.sh` があれば Docker の検出を足す。

土台の `.claude/settings.json` が無いときは、`AskUserQuestion` で次を聞く。

| 選択肢 | 次の動き |
| --- | --- |
| 先に init-repo を実行する（推奨） | ここで止め、`/project:init-repo` を実行してから `/project:wordpress` を呼び直すよう案内する。どちらも Claude からは呼べないため、利用者が実行する |
| このまま進める | 次の影響を伝えて続ける。`lefthook.yml` も無ければ、PHP の Lint をフックで動かせない（Lint の設定と規約は入る）。`guard-destructive.sh` も無ければ、`docker compose down -v` を止められない。秘匿ファイルの deny も入らない |

## `--check` のラベル

ラベルの意味は次のとおり。

| ラベル | 意味 |
| --- | --- |
| `NEW` | 導入先に存在しない。コピー対象 |
| `SAME` | 既存ファイルと内容が一致。何もしない |
| `DIFF` | 既存ファイルと内容が異なる。**自動では触らない** |

## 既存の WordPress の探し方

あわせて、既存の WordPress を Glob で探す。`vendor/`・`node_modules/` は除く。

| 探すもの | パターン |
| --- | --- |
| テーマ | `**/wp-content/themes/*/style.css`（`twenty` で始まる標準のテーマは除く） |
| mu-plugins | `**/wp-content/mu-plugins/*.php` |
| ローカル環境 | `**/compose.yaml`・`**/compose.yml`・`**/docker-compose.yaml`・`**/docker-compose.yml` |
| Lint の設定 | `**/phpcs.xml`・`**/phpcs.xml.dist`・`**/.phpcs.xml.dist`・`**/composer.json` |

あわせて、プラグインを Git で管理しているかを確かめる。`wp-content/plugins/` の下に追跡中のファイルがあれば、管理している。

```bash
git ls-files -- '*wp-content/plugins/*'
```

## 状態の判定

結果から、次のどれに当たるかを決める。

| 状態 | 扱い |
| --- | --- |
| A：WordPress のファイルが無い | テンプレート全体を入れる。手順 2 でスラッグとローカル環境を決める |
| B：`wordpress/wp-content/` に既存のテーマがある | テーマの雛形（`wordpress/wp-content/themes/my-theme/` 配下）は入れない。`themes/` に 2 つ目のテーマができるため。名前は手順 2 で既存のテーマから調べる。自作のテーマが複数あれば、どれを対象にするかを聞く |
| C：別の場所に既存の構成がある（例：ルート直下の `wp-content/`） | ファイルを動かさない。デプロイ・Docker のマウント・CI が今のパスに依存しているため。規約（`.claude/rules/wordpress*.md`）だけをコピーし、手順 7 で今の場所に合わせる。テーマの雛形・ローカル環境・README は入れない。名前は B と同じく既存のテーマから調べる |

ローカル環境のファイルが既にある場合は、状態にかかわらず Docker の雛形（`wordpress/compose.yaml`・`wordpress/.env.example`）を入れない。2 つ目の構成ができ、どちらで起動するかが分からなくなるため。

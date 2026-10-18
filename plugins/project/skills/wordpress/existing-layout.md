# 既存の WordPress がある場合

`wordpress` の手順 1 で、既存の WordPress を探して状態（A・B・C）を決めるときと、手順 7（C の場合）で使う。

## 既存の WordPress を探す（手順 1）

既存の WordPress を Glob で探す。`vendor/`・`node_modules/` は除く。

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

## 状態を決める（手順 1）

| 状態 | 扱い |
| --- | --- |
| A：WordPress のファイルが無い | テンプレート全体を入れる。手順 2 でスラッグとローカル環境を決める |
| B：`wordpress/wp-content/` に既存のテーマがある | テーマの雛形（`wordpress/wp-content/themes/my-theme/` 配下）は入れない。`themes/` に 2 つ目のテーマができるため。名前は手順 2 で既存のテーマから調べる。自作のテーマが複数あれば、どれを対象にするかを聞く |
| C：別の場所に既存の構成がある（例：ルート直下の `wp-content/`） | ファイルを動かさない。デプロイ・Docker のマウント・CI が今のパスに依存しているため。規約（`.claude/rules/wordpress.md`・`wordpress-security.md`・`wordpress-templates.md`）だけをコピーし、手順 7 で今の場所に合わせる。テーマの雛形・ローカル環境・README は入れない。名前は B と同じく既存のテーマから調べる |

ローカル環境のファイルが既にある場合は、状態にかかわらず Docker の雛形（`wordpress/compose.yaml`・`wordpress/.env.example`）を入れない。2 つ目の構成ができ、どちらで起動するかが分からなくなるため。

## 今の場所に合わせる（手順 7。C の場合）

- コピーした 3 つの規約の、frontmatter の `paths` と、本文の `wordpress/` で始まるパスを、今の構成の場所に書き換える
- Lint の設定（`composer.json`・`phpcs.xml.dist`）と `.gitignore` は、テンプレートを Read し、今の構成の WordPress のルート（`wp-content/` を持つディレクトリ）に作る案を出す。`phpcs.xml.dist` の `<file>` は、今のテーマと mu-plugins のディレクトリにする
- 既にあるファイルには、手順 6 と同じマージ方針で、足りない分だけを足す

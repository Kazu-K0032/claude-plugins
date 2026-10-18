# 衝突したファイルと、C の場合の合わせ方

手順 6 で `DIFF` のファイルを片付けるとき、手順 7 で C の場合に今の場所へ合わせるときに読む。

## 衝突したファイルを片付ける（手順 6）

差分は、次のコマンドで見せる。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/<同じ相対パス>"
```

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `.claude/rules/wordpress*.md` | 既存の規約に足りない項目だけを、仮の名前を置き換えてから足す |
| `wordpress/compose.yaml` | 上書きしない。既存のローカル環境を正とする |
| `wordpress/.env.example` | 足りない変数だけを足す |
| `wordpress/composer.json` | 既存を正とする。`require-dev` の 3 つのパッケージ、`config.allow-plugins`、`scripts` の `lint`・`lint:fix` のうち、無いものだけを足す。既にある版は変えない |
| `wordpress/phpcs.xml.dist` | 既存を正とする。外している規則と対象のディレクトリは変えない。`WordPress.WP.I18n` の Text Domain が無ければ、足すことを提案する |
| `wordpress/.gitignore` | 足りない行だけを足す。プラグインを Git で管理している場合（手順 1）は、`/wp-content/plugins/` を足さない |
| README（`wordpress/README.md` など） | 既存の一覧に、足したファイルの行だけを足す |
| テーマのファイル | 上書きしない |

## 今の場所に合わせる（手順 7）

コピーした `.claude/rules/wordpress*.md` の、frontmatter の `paths` と、本文の `wordpress/` で始まるパスを、今の構成の場所に書き換える。

Lint の設定（`composer.json`・`phpcs.xml.dist`）と `.gitignore` は、テンプレートを Read し、今の構成の WordPress のルート（`wp-content/` を持つディレクトリ）に作る案を出す。`phpcs.xml.dist` の `<file>` は、今のテーマと mu-plugins のディレクトリにする。既にあるファイルには、手順 6 の方針で足りない分だけを足す。

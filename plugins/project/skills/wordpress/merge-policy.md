# 衝突したファイルのマージ方針

`wordpress` の手順 6 で、`DIFF` のファイルがあるとき、上書き / 手でマージ / 据え置きを選んでもらう前に読む。手順 7（C の場合）で既にあるファイルに足すときにも使う。ファイルごとの「上書きしない」は、選択肢を示すときに伝える。テンプレートは仮の名前のままのため、名前だけの差分は差分として扱わない。

| ファイル | マージ方針 |
| --- | --- |
| `.claude/rules/wordpress.md`・`wordpress-security.md`・`wordpress-templates.md` | 既存の規約に足りない項目だけを、仮の名前を置き換えてから足す |
| `wordpress/compose.yaml` | 上書きしない。既存のローカル環境を正とする |
| `wordpress/.env.example` | 足りない変数だけを足す |
| `wordpress/composer.json` | 既存を正とする。`require-dev` の 3 つのパッケージ、`config.allow-plugins`、`scripts` の `lint`・`lint:fix` のうち、無いものだけを足す。既にある版は変えない |
| `wordpress/phpcs.xml.dist` | 既存を正とする。外している規則と対象のディレクトリは変えない。`WordPress.WP.I18n` の Text Domain が無ければ、足すことを提案する |
| `wordpress/.gitignore` | 足りない行だけを足す。プラグインを Git で管理している場合（手順 1）は、`/wp-content/plugins/` を足さない |
| README（`wordpress/README.md` など） | 既存の一覧に、足したファイルの行だけを足す |
| テーマのファイル | 上書きしない |

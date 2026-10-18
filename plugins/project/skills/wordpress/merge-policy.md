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

## 古い 1 ファイル版

前の版の `wordpress.md` には、出力・入力・テンプレートの節があった。今は `wordpress-security.md` と `wordpress-templates.md` に移している。

| 古い `wordpress.md` の節 | 移した先 |
| --- | --- |
| 出力のエスケープ | `wordpress-security.md` の「値を画面に出す場合」 |
| 入力の検証 | `wordpress-security.md` の「入力を受け取る場合」 |
| 国際化（i18n） | `wordpress-templates.md` の「固定の文言を書く場合」 |
| テンプレートパーツ | `wordpress-templates.md` の「テンプレートパーツに分ける場合」 |
| テンプレートの中の繰り返し | `wordpress-templates.md` の「同じ形を繰り返す場合」 |
| クエリとループ | `wordpress-templates.md` の「投稿を取得する場合」 |
| ページテンプレートの構造 | `wordpress-templates.md` の「ページテンプレートを書く場合」 |
| アセットの読み込みと参照 | `wordpress-templates.md` の「CSS・JS・画像を使う場合」 |

`wordpress.md` を上書きしないとき（手でマージ・据え置き）は、古い `wordpress.md` に移した節が残り、同じ規則が複数の場所になる。重なる節を消すかを、利用者に聞く。

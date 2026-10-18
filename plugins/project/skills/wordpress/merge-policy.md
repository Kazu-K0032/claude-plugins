# 衝突したファイルのマージ方針

`wordpress` の手順 6 で、`DIFF` のファイルがあるとき、上書き / 手でマージ / 据え置きを選んでもらう前に読む。手順 7（C の場合）で既にあるファイルに足すときにも使う。ファイルごとの「上書きしない」は、選択肢を示すときに伝える。テンプレートは仮の名前のままのため、名前だけの差分は差分として扱わない。

| ファイル | マージ方針 |
| --- | --- |
| `.claude/rules/wordpress.md`・`wordpress-security.md`・`wordpress-templates.md` | 既存の規約に足りない項目だけを、仮の名前を置き換えてから足す。導入済みの `wordpress.md` が 1 ファイル版なら、下の「古い 1 ファイル版の片付け」も行う |
| `wordpress/compose.yaml` | 上書きしない。既存のローカル環境を正とする |
| `wordpress/.env.example` | 足りない変数だけを足す |
| `wordpress/composer.json` | 既存を正とする。`require-dev` の 3 つのパッケージ、`config.allow-plugins`、`scripts` の `lint`・`lint:fix` のうち、無いものだけを足す。既にある版は変えない |
| `wordpress/phpcs.xml.dist` | 既存を正とする。外している規則と対象のディレクトリは変えない。`WordPress.WP.I18n` の Text Domain が無ければ、足すことを提案する |
| `wordpress/.gitignore` | 足りない行だけを足す。プラグインを Git で管理している場合（手順 1）は、`/wp-content/plugins/` を足さない |
| README（`wordpress/README.md` など） | 既存の一覧に、足したファイルの行だけを足す |
| テーマのファイル | 上書きしない |

## 古い 1 ファイル版の片付け

規約は、前は `wordpress.md` の 1 ファイルだった。今は、出力と入力の節を `wordpress-security.md` に、テンプレートの節を `wordpress-templates.md` に分けている。導入済みの `wordpress.md` に次の節があれば、1 ファイル版として扱う。

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

- 2 つの新しいファイルは新規で入るため、`既存は置き換えない` のときも、同じ規則が複数のファイルに残る。`DIFF` の選択肢を示す前に、このことを伝える
- 移した節を `wordpress.md` から消すかを、利用者に聞く。残すと、片方だけ直したときに規則が食い違うため
- 消すと決まったら、`Edit` で節を消す。利用先が行を足していれば、消す前に移した先へ移すかを聞く
- 節の名前が変わっていて見つけられないときは、消さずに、重なっていそうな節を示して利用者に任せる

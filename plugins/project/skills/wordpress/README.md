# wordpress

WordPress のリポジトリへ「`wordpress/wp-content/` 配下のテーマと mu-plugins の構成 ＋ Docker のローカル環境 ＋ PHP の Lint の設定 ＋ 置き場所と実装の規約」を持ち込む Skill。

`files/` の中身がそのまま導入先リポジトリのルートに置かれる。テーマの仮の名前（`my-theme` など）は、導入時に決めた名前へ置き換わる。

## 使い方

導入先のリポジトリのルートで Claude Code を開き、次を実行する。`.claude/settings.json`（土台）が無ければ、先に `/project:init-repo` を実行するかを Skill が聞く。

```text
/project:wordpress
```

衝突状況の確認 → テーマの名前とローカル環境の決定 → 計画の提示 → 承認 → コピー → 名前の置き換え → 衝突の片付け → フックへの PHP の Lint と Docker の検出の追加、の順に進む。Docker のローカル環境を作るかは、実行中に聞かれる。

| 引数 | 動き |
| --- | --- |
| `--rules-only` | `.claude/rules/` の 3 つの規約（`wordpress.md`・`wordpress-security.md`・`wordpress-templates.md`）だけを入れる |
| `--lint-only` | `composer.json`・`phpcs.xml.dist` だけを入れ、フックに PHP の Lint を足す |
| `--no-docker` | Docker のローカル環境を入れない |
| `--keep-existing` | 既存のファイルと内容が違うもの（`DIFF`）は、すべて据え置く。フックへの PHP の Lint と Docker の検出の追記と、ADR の一覧への行の追加は、既存のファイルにも行う |

「規約だけ」「既存は置き換えない」のような同じ意味の言い方も、同じに扱う。

既にテーマがある場合は、テーマの雛形を入れない。WordPress が `wordpress/wp-content/` 以外の場所にある場合は、ファイルを動かさず、規約と Lint の設定を今の場所に合わせて入れる。手順の詳細は [SKILL.md](SKILL.md) を参照。

Claude を介さず手で入れる場合は、スクリプトを直接叩いてもよい（リポジトリのルートで実行する）。名前の置き換えは手で行う。

```bash
bash <plugin>/scripts/install.sh --skill wordpress --check  # 状態確認だけ
bash <plugin>/scripts/install.sh --skill wordpress --apply  # 未存在のファイルだけコピー
```

## 収録物

| パス | 内容 | 導入後の調整 |
| --- | --- | --- |
| `files/.claude/rules/wordpress.md` | 置き場所（テーマ・mu-plugins・初期データ・ローカル環境）・名前・PHPDoc・Lint の規約 | そのまま使える（プラグインを Git で管理しているリポジトリでは、Skill がプラグインの行を直す） |
| `files/.claude/rules/wordpress-security.md` | 出力のエスケープ・入力の検証（nonce・権限・SQL のプレースホルダ）の規約。`wordpress.md` と同じファイルを開いたときに読み込まれる | そのまま使える |
| `files/.claude/rules/wordpress-templates.md` | 国際化・テンプレートパーツ・テンプレートの中の繰り返し・クエリ・ページテンプレートの構造・アセットの読み込みの規約。`wordpress.md` と同じファイルを開いたときに読み込まれる | そのまま使える |
| `files/wordpress/README.md` | `wordpress/` の案内板 | ファイルを足したら行を足す |
| `files/wordpress/.gitignore` | WordPress 本体・アップロード・サードパーティのプラグイン・`.env`・Composer の依存の除外 | そのまま使える（プラグインを Git で管理しているリポジトリでは、Skill が `/wp-content/plugins/` を外す） |
| `files/wordpress/compose.yaml` | ローカル環境（MySQL・WordPress・WP-CLI）。テーマと mu-plugins だけをマウントする。入れるかは実行時に聞く | イメージのタグを本番の版に合わせる |
| `files/wordpress/.env.example` | ローカル環境の DB の接続情報とポートの雛形 | 変えるときだけ `.env` にコピーする |
| `files/wordpress/composer.json` | Lint のツール（WordPress のコーディング規約・PHP の版の互換性）と、`composer lint`・`composer lint:fix` | そのまま使える |
| `files/wordpress/phpcs.xml.dist` | Lint の規則。WordPress の規約を土台に、整形の規則と、日本語のコメントやテンプレートの 1 行の PHP に合わない規則を外す。対象はテーマと mu-plugins | `testVersion`・`minimum_wp_version` を本番の版に合わせる |
| `files/wordpress/wp-content/mu-plugins/README.md` | mu-plugins の案内板 | ファイルを足したら行を足す |
| `files/wordpress/wp-content/themes/my-theme/` | クラシックテーマの最小構成（`style.css`・`functions.php`・`inc/`・`header.php`・`footer.php`・`index.php`・`template-parts/`・案内板の `README.md`） | `style.css` の `Description` と版を書く |

Lint の設定を入れたときは、規則を決めた理由の ADR（`adr/php-coding-standards.md`）も、利用先の ADR の置き場所に日付を付けて足す。置き場所はプロジェクトごとに違うため、`files/` には含めず、Skill が置き場所を探して書く（[P3](../../../../docs/policies/p03-check-placement.md)）。

## 前提と制約

- クラシックテーマ（PHP のテンプレート）だけを対象にする。ブロックテーマ（`theme.json`・HTML のテンプレート）は、規約の前提（`get_template_part()`・PHP でのエスケープ）が合わないため対象外
- WordPress のファイルは `wordpress/` 配下に置く前提にしている。リポジトリのルートに `docs/`・インフラの設定などを並べても、WordPress のファイルと混ざらないようにするため。既存の構成が別の場所にある場合は、ファイルを動かさず規約の側を合わせる
- サードパーティのプラグインは Git で管理しない前提にしている。版の追跡と、再配布のライセンスの確認を避けるため。自分で書く処理は mu-plugins に置く
- Lint の規則は、WordPress の規約から整形の規則（インデント・配列の書き方・Yoda 条件・括弧の内側の空白・項目の縦揃え）を外している。エディタの整形と食い違いやすいため。あわせて、コメントを日本語で書くための規則（句読点・大文字）と、テンプレートの 1 行の PHP（`<?php foo(); ?>`）を認めるための規則も外している。エスケープ・nonce・国際化の規則は残している。外した規則の理由は、`phpcs.xml.dist` のコメントにある
- ローカル環境は Docker で動かす前提の雛形にしている。Local・wp-env など別の方法を使うなら、実行時に「作らない」を選ぶ
- `composer install`・ローカル環境の起動・WordPress の初期設定・テーマの有効化は、Skill は行わない（人が行う）。依存やイメージの取得、DB の書き換えを伴うため

## 除外したもの

| 除外したもの | 理由 |
| --- | --- |
| ローカル環境の周辺のサービスと設定（メールの捕捉・アップロードの上限・コンテナの中から自分の URL へつなぐ設定） | 使うプラグインと運用で要るかが変わる。要るときに `compose.yaml` に足す |
| 初期データと取り込みのスクリプト | 投稿タイプ・カスタムフィールドがプロジェクトごとに違う。規約の「初期データを作る場合」に書き方だけを書いている |
| ビルド（Vite など）・JS と CSS の Lint の設定 | 使うかどうか、どのツールを使うかがプロジェクトごとに違う |
| PHPStan（型の検査） | 使うプラグインごとに、型の情報（スタブ）を足す手間がかかる。入れるかはプロジェクトごとに決める |
| 投稿タイプなどの mu-plugins の雛形 | 中身がプロジェクトごとに違う |
| 静的化・デプロイ・インフラの設定 | 配信の構成（ホスティング・CDN・静的化）ごとに違う |

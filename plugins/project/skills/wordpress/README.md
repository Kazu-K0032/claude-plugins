# wordpress

WordPress のリポジトリへ「`wordpress/wp-content/` 配下のテーマと mu-plugins の構成 ＋ Docker のローカル環境 ＋ PHP の Lint の設定 ＋ 置き場所と実装の規約」を持ち込む Skill。

`files/` の中身がそのまま導入先リポジトリのルートに置かれる。テーマの仮の名前（`my-theme` など）は、導入時に決めた名前へ置き換わる。

## 使い方

導入先のリポジトリのルートで Claude Code を開き、次を実行する。`.claude/settings.json`・`CLAUDE.md` などの土台も要るなら、先に `/project:init-repo` を実行しておく。

```text
/project:wordpress
```

衝突状況の確認 → テーマの名前とローカル環境の決定 → 計画の提示 → 承認 → コピー → 名前の置き換え → 衝突の片付け → Lint のフックへの追加、の順に進む。Docker のローカル環境を作るかは、実行中に聞かれる。

| 引数の例 | 動き |
| --- | --- |
| `規約だけ` | `.claude/rules/wordpress.md` だけを入れる |
| `Lint だけ` | `composer.json`・`phpcs.xml.dist` だけを入れ、フックに PHP の Lint を足す |
| `Docker なし` | Docker のローカル環境を入れない |
| `既存は置き換えない` | 既存ファイルに触らない |

既にテーマがある場合は、テーマの雛形を入れない。WordPress が `wordpress/wp-content/` 以外の場所にある場合は、ファイルを動かさず、規約と Lint の設定を今の場所に合わせて入れる。手順の詳細は [SKILL.md](SKILL.md) を参照。

Claude を介さず手で入れる場合は、スクリプトを直接叩いてもよい（リポジトリのルートで実行する）。名前の置き換えは手で行う。

```bash
bash <plugin>/scripts/install.sh --skill wordpress --check  # 状態確認だけ
bash <plugin>/scripts/install.sh --skill wordpress --apply  # 未存在のファイルだけコピー
```

## 収録物

| パス | 内容 | 導入後の調整 |
| --- | --- | --- |
| `files/.claude/rules/wordpress.md` | 置き場所（テーマ・mu-plugins・初期データ・ローカル環境）・出力のエスケープ・入力の検証・国際化・テンプレートパーツ・クエリ・PHPDoc・Lint の規約 | プラグインを Git で管理するなら、「置き場所」の表のプラグインの行を直す |
| `files/wordpress/README.md` | `wordpress/` の案内板 | ファイルを足したら行を足す |
| `files/wordpress/.gitignore` | WordPress 本体・アップロード・サードパーティのプラグイン・`.env`・Composer の依存の除外 | プラグインを Git で管理するなら `/wp-content/plugins/` を外す |
| `files/wordpress/compose.yaml` | ローカル環境（MySQL・WordPress・WP-CLI）。テーマと mu-plugins だけをマウントする。入れるかは実行時に聞く | イメージのタグを本番の版に合わせる |
| `files/wordpress/.env.example` | ローカル環境の DB の接続情報とポートの雛形 | 変えるときだけ `.env` にコピーする |
| `files/wordpress/composer.json` | Lint のツール（WordPress のコーディング規約・PHP の版の互換性）と、`composer lint`・`composer lint:fix` | そのまま使える |
| `files/wordpress/phpcs.xml.dist` | Lint の規則。WordPress の規約を土台に、整形の規則だけ外す。対象はテーマと mu-plugins | `testVersion`・`minimum_wp_version` を本番の版に合わせる |
| `files/wordpress/wp-content/mu-plugins/README.md` | mu-plugins の案内板 | ファイルを足したら行を足す |
| `files/wordpress/wp-content/themes/my-theme/` | クラシックテーマの最小構成（`style.css`・`functions.php`・`inc/`・`header.php`・`footer.php`・`index.php`・`template-parts/`・案内板の `README.md`） | `style.css` の `Description` と版を書く |

## 前提と制約

- クラシックテーマ（PHP のテンプレート）だけを対象にする。ブロックテーマ（`theme.json`・HTML のテンプレート）は、規約の前提（`get_template_part()`・PHP でのエスケープ）が合わないため対象外
- WordPress のファイルは `wordpress/` 配下に置く前提にしている。リポジトリのルートに `docs/`・インフラの設定などを並べても、WordPress のファイルと混ざらないようにするため。既存の構成が別の場所にある場合は、ファイルを動かさず規約の側を合わせる
- サードパーティのプラグインは Git で管理しない前提にしている。版の追跡と、再配布のライセンスの確認を避けるため。自分で書く処理は mu-plugins に置く
- Lint の規則は、WordPress の規約から整形の規則（インデント・配列の書き方・Yoda 条件・括弧の内側の空白）を外している。エディタの整形と食い違いやすいため。エスケープ・nonce・国際化の規則は残している
- ローカル環境は Docker で動かす前提の雛形にしている。Local・wp-env など別の方法を使うなら、実行時に「作らない」を選ぶ
- `composer install`・ローカル環境の起動・WordPress の初期設定・テーマの有効化は、Skill は行わない（人が行う）。依存やイメージの取得、DB の書き換えを伴うため

## 除外したもの

| 除外したもの | 理由 |
| --- | --- |
| ローカル環境の周辺のサービスと設定（メールの捕捉・アップロードの上限・コンテナの中から自分の URL へつなぐ設定） | 使うプラグインと運用で要るかが変わる。要るときに `compose.yaml` に足す |
| 初期データと取り込みのスクリプト | 投稿タイプ・カスタムフィールドがプロジェクトごとに違う。規約の「初期データ」に書き方だけを書いている |
| ビルド（Vite など）・JS と CSS の Lint の設定 | 使うかどうか、どのツールを使うかがプロジェクトごとに違う |
| PHPStan（型の検査） | 使うプラグインごとに、型の情報（スタブ）を足す手間がかかる。入れるかはプロジェクトごとに決める |
| 投稿タイプなどの mu-plugins の雛形 | 中身がプロジェクトごとに違う |
| 静的化・デプロイ・インフラの設定 | 配信の構成（ホスティング・CDN・静的化）ごとに違う |

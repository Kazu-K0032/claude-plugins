---
paths:
  - "wordpress/**/*.php"
  - "wordpress/seed/**"
  - "wordpress/compose.yaml"
---

# WordPress の置き場所と名前に関するルール

`wordpress/` の下で、テーマと mu-plugins を Git で管理する構成を前提にする。WordPress のコーディング規約に従い、Lint（`wordpress/phpcs.xml.dist`）で見つけられない書き方を、このファイルと `wordpress-security.md`・`wordpress-templates.md` で決める。このファイルでは、置き場所・名前・PHPDoc・Lint の実行を決める。

このリポジトリの固有の値は次のとおり。

| 項目 | 値 |
| --- | --- |
| テーマのディレクトリ | `wordpress/wp-content/themes/my-theme/` |
| Text Domain | `my-theme` |
| 関数の接頭辞 | `my_theme_` |
| 定数の接頭辞 | `MY_THEME_` |
| `@package` | `My_Theme` |

## ファイルを置く場合

置き場所は「テーマを替えても残すか」で決める。

| 置くもの | 置き場所 |
| --- | --- |
| 見た目と表示の処理（テンプレート・CSS・JS・画像） | `wordpress/wp-content/themes/my-theme/` |
| テーマを替えても残す処理（投稿タイプ・タクソノミー・カスタムフィールドの登録、サイト固有の処理） | `wordpress/wp-content/mu-plugins/` |
| 開発用の初期データと、取り込みのスクリプト | `wordpress/seed/` |
| ローカル環境の設定（`compose.yaml` など） | `wordpress/` 直下 |
| サードパーティのプラグイン | Git で管理しない（`wordpress/.gitignore`） |

### テーマに書く場合

- テーマには表示の処理（マークアップ・テンプレートの分岐・アセットの読み込み）だけを置く。投稿タイプの登録をテーマに置くと、テーマを替えたときに投稿が管理画面から見えなくなるため
- `functions.php` は `inc/` のファイルを読み込むだけにし、処理を直接書かない。処理は役割ごとに `inc/` のファイルへ分ける（`setup.php`・`enqueue.php` など）

### mu-plugins に書く場合

- 1 つの機能を 1 つのファイルにし、ファイルを足したら `mu-plugins/README.md` の表に行を足す
- 自動で読み込まれるのは直下のファイルだけ。サブディレクトリに分けるときは、直下に読み込み用のファイルを置く。Ref: [Must Use Plugins](https://developer.wordpress.org/advanced-administration/plugins/mu-plugins/)
- 管理画面から無効にできず、通常のプラグインより先に読み込まれる。壊れたコードを置くと管理画面も開けなくなるため、Lint を通してから置く

### 初期データを作る場合

- 取り込みは、何度実行しても同じ結果になるように書く。スラッグで投稿を探し、あれば更新し、無ければ作る。2 回目の実行で投稿が増えないようにするため
- 本番の個人情報（問い合わせ・会員の情報）を入れない
- 本文の画像は `wordpress/seed/` に同梱し、外部の URL を本文に残さない。参照先が消えると、取り込んだだけで画像が切れるため
- 取り込みの手順は手順書（`docs/runbook/` など）に書く

### ローカル環境を整える場合

- Docker で動かすときは `wordpress/compose.yaml`（MySQL・WordPress・WP-CLI）を使う。値を変えるときは `.env.example` を `.env` にコピーして書き換え、`.env` はコミットしない
- WordPress・PHP・DB の版（`compose.yaml` のイメージのタグ）は、本番に合わせる。版の違いで、本番だけで起きる不具合を見逃さないため
- テーマと mu-plugins のディレクトリだけをコンテナにマウントし、WordPress 本体はコンテナ側に置く。テーマを足したら、`compose.yaml` のマウントにも足す
- 送信メールを確かめるときは、外へ出さずに手元で受け取る仕組み（Mailpit など）を `compose.yaml` に足す。問い合わせフォームの確認で、実際にメールが届かないようにするため

## 名前を付ける場合

- テーマと mu-plugins で定義する関数には `my_theme_`、定数には `MY_THEME_` を付ける。WordPress 本体やプラグインと名前がぶつからないようにするため
- Lint の接頭辞の規則は有効にしていない（理由は `phpcs.xml.dist`）。名前を付けるときに、このルールで守る
- 変数に、WordPress のグローバル変数と同じ名前（`$post`・`$title` など）を使わない。テンプレートでは WordPress の値を上書きすることがあり、Lint（`WordPress.WP.GlobalVariablesOverride`）も止めるため

## PHPDoc を書く場合

[PHP Documentation Standards](https://developer.wordpress.org/coding-standards/inline-documentation-standards/php/) に従う（要約の言語を除く）。すべての PHP ファイルと関数に DocBlock を置く。

- 要約は、ほかのコメントと同じく日本語で書く。関数は「〜を返す。」「〜を登録する。」のように句点で終え、ファイルの先頭の要約には句点を付けない
- `@package` は `My_Theme` にする
- 戻り値の無い関数には `@return` を書かない。`@return void` は、WordPress 本体の標準テーマ以外では使わないため
- タグの順は `@global` → `@param` → `@return`

```php
/**
 * 投稿タイプの表示名を返す。
 *
 * @param string $post_type 投稿タイプのスラッグ。
 * @return string 表示名。投稿タイプが無ければ空文字。
 */
function my_theme_post_type_label($post_type) {
```

テンプレートパーツの `$args` は、`@var` と `@type` で全キーを書く。

```php
/**
 * ヒーローのセクション
 *
 * @package My_Theme
 *
 * @var array<string,mixed> $args {
 *     @type string     $title 見出し。
 *     @type array|null $cta   ボタン {label, url}（任意）。
 * }
 */
```

## PHP を直す場合

- PHP を直したら、`wordpress/` で `composer lint` を実行し、指摘を直す。`composer lint:fix` で直せるものは自動で直る
- 指摘を `phpcs:ignore` で消すときは、規則の名前と理由を同じ行に書く（`wordpress-templates.md` の SVG の例）
- 規則を外す・足すときは `phpcs.xml.dist` を直し、理由をコメントに書く

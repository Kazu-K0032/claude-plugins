---
paths:
  - "wordpress/**/*.php"
  - "wordpress/seed/**"
  - "wordpress/compose.yaml"
docs-type: people-ai-doc
---

# WordPress の実装ルール

`wordpress/` の下で、テーマと mu-plugins を Git で管理する構成を前提にする。WordPress のコーディング規約に従い、Lint（`wordpress/phpcs.xml.dist`）で見つけられない書き方をこのファイルで決める。

このリポジトリの固有の値は次のとおり。

| 項目 | 値 |
| --- | --- |
| テーマのディレクトリ名・Text Domain | `my-theme` |
| 関数の接頭辞 | `my_theme_` |
| 定数の接頭辞 | `MY_THEME_` |
| `@package` | `My_Theme` |

## 置き場所

置き場所は「テーマを替えても残すか」で決める。

| 置くもの | 置き場所 |
| --- | --- |
| 見た目と表示の処理（テンプレート・CSS・JS・画像） | `wordpress/wp-content/themes/my-theme/` |
| テーマを替えても残す処理（投稿タイプ・タクソノミー・カスタムフィールドの登録、サイト固有の処理） | `wordpress/wp-content/mu-plugins/` |
| 開発用の初期データと、取り込みのスクリプト | `wordpress/seed/` |
| ローカル環境の設定（`compose.yaml` など） | `wordpress/` 直下 |
| サードパーティのプラグイン | Git で管理しない（`wordpress/.gitignore`） |

### テーマ

- テーマには表示の処理（マークアップ・テンプレートの分岐・アセットの読み込み）だけを置く。投稿タイプの登録をテーマに置くと、テーマを替えたときに投稿が管理画面から見えなくなるため
- `functions.php` は `inc/` のファイルを読み込むだけにし、処理を直接書かない。処理は役割ごとに `inc/` のファイルへ分ける（`setup.php`・`enqueue.php` など）

### mu-plugins

- 1 つの機能を 1 つのファイルにし、ファイルを足したら `mu-plugins/README.md` の表に行を足す
- 自動で読み込まれるのは直下のファイルだけ。サブディレクトリに分けるときは、直下に読み込み用のファイルを置く。Ref: [Must Use Plugins](https://developer.wordpress.org/advanced-administration/plugins/mu-plugins/)
- 管理画面から無効にできず、通常のプラグインより先に読み込まれる。壊れたコードを置くと管理画面も開けなくなるため、Lint を通してから置く

### 初期データ

- 取り込みは、何度実行しても同じ結果になるように書く。スラッグで投稿を探し、あれば更新し、無ければ作る。2 回目の実行で投稿が増えないようにするため
- 本番の個人情報（問い合わせ・会員の情報）を入れない
- 本文の画像は `wordpress/seed/` に同梱し、外部の URL を本文に残さない。参照先が消えると、取り込んだだけで画像が切れるため
- 取り込みの手順は手順書（`docs/runbook/` など）に書く

### ローカル環境

- Docker で動かすときは `wordpress/compose.yaml`（MySQL・WordPress・WP-CLI）を使う。値を変えるときは `.env.example` を `.env` にコピーして書き換え、`.env` はコミットしない
- WordPress・PHP・DB の版（`compose.yaml` のイメージのタグ）は、本番に合わせる。版の違いで、本番だけで起きる不具合を見逃さないため
- テーマと mu-plugins のディレクトリだけをコンテナにマウントし、WordPress 本体はコンテナ側に置く。テーマを足したら、`compose.yaml` のマウントにも足す
- 送信メールを確かめるときは、外へ出さずに手元で受け取る仕組み（Mailpit など）を `compose.yaml` に足す。問い合わせフォームの確認で、実際にメールが届かないようにするため

## 出力のエスケープ

画面に出す値は、出力する直前にエスケープする。早めにエスケープした変数は、後で使い道が変わったときに誤ったエスケープのまま出てしまうため。Ref: [Escaping Data](https://developer.wordpress.org/apis/security/escaping/)

| 出力する場所 | 固定の文言（翻訳あり） | DB・変数の値（翻訳なし） |
| --- | --- | --- |
| タグの中身 | `esc_html_e('文言', 'my-theme')` | `echo esc_html($value)` |
| `href`・`src` | — | `echo esc_url($url)` |
| そのほかの属性 | `esc_attr_e('文言', 'my-theme')` | `echo esc_attr($value)` |
| HTML を含む本文 | — | `echo wp_kses_post($html)` |

- `echo $value` と直接書かない。必ずエスケープの関数を通す
- `get_post_meta()`・`get_option()` の戻り値はエスケープされていない
- テンプレートタグは、出す場所で使い分ける

| 出力する値 | タグの中身 | 属性 |
| --- | --- | --- |
| タイトル | `echo esc_html(get_the_title())` | `the_title_attribute()` |
| パーマリンク | — | `the_permalink()`（中で `esc_url()` 済み）・`echo esc_url(get_permalink())` |
| 本文 | `the_content()`（`esc_html()` を掛けない） | — |

## 入力の検証

`$_GET`・`$_POST`・`$_REQUEST`・`$_COOKIE`・`$_SERVER` の値は、利用者が自由に書き換えられる。使う前に必ず確かめる。Ref: [Sanitizing Data](https://developer.wordpress.org/apis/security/sanitizing/)

- 取りうる値が決まっている入力は、許す値の一覧と照らし合わせる（検証）。自由な入力は、型に合わせた関数で無害化する
- 先に `isset()` で有無を確かめ、`wp_unslash()` で WordPress が足したエスケープを外してから無害化する

| 入力 | 関数 |
| --- | --- |
| 1 行のテキスト | `sanitize_text_field()` |
| 複数行のテキスト | `sanitize_textarea_field()` |
| メールアドレス | `sanitize_email()` |
| URL | `sanitize_url()` |
| 整数（ID など） | `absint()` |
| キー（英小文字・数字・`_`・`-`） | `sanitize_key()` |
| HTML を含む本文 | `wp_kses_post()` |

- フォーム・管理画面の操作・Ajax には nonce を付け、受け取った側で確かめる。付けるのは `wp_nonce_field()`、確かめるのは `check_admin_referer()`（管理画面）・`check_ajax_referer()`（Ajax）・`wp_verify_nonce()`（それ以外）
- nonce は権限の確認にならない。データを変える処理では、`current_user_can()` で権限も確かめる。Ref: [Nonces](https://developer.wordpress.org/apis/security/nonces/)
- `$wpdb` で SQL を組むときは、値を文字列でつながず、`$wpdb->prepare()` のプレースホルダ（`%s`・`%d`・`%f`・`%i`）で渡す。プレースホルダは引用符で囲まない。Ref: [wpdb::prepare()](https://developer.wordpress.org/reference/classes/wpdb/prepare/)
- 投稿を取るだけなら、`$wpdb` ではなく `WP_Query`・`get_posts()` を使う

```php
if (
    !isset($_POST['my_theme_nonce'])
    || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['my_theme_nonce'])), 'my_theme_save')
    || !current_user_can('edit_posts')
) {
    wp_die(esc_html__('この操作は許可されていません。', 'my-theme'));
}

$title = isset($_POST['title']) ? sanitize_text_field(wp_unslash($_POST['title'])) : '';
```

## 国際化（i18n）

- テンプレートに直接書く固定の文言は、翻訳関数で囲む。Text Domain は `my-theme` にする
- 翻訳関数の引数には文字列をそのまま書き、変数を渡さない。翻訳する文字列は、PHP を実行せずにソースから抜き出すため。Ref: [Internationalization Guidelines](https://developer.wordpress.org/apis/internationalization/internationalization-guidelines/)

```php
// タグの中身へ出力する
<?php esc_html_e('詳しく見る', 'my-theme'); ?>

// 属性へ出力する
<img alt="<?php esc_attr_e('商品の写真', 'my-theme'); ?>" src="...">

// 翻訳とエスケープを済ませた文字列を、変数として使う
$label = esc_html__('詳細', 'my-theme');
```

## テンプレートパーツ

- 繰り返し使う HTML のかたまりは、`template-parts/<分類>/<名前>.php` に分ける
- パーツへ渡すデータは、`get_template_part()` の第 3 引数（`$args`）で渡す。グローバル変数で渡さない。値の出どころを 1 か所に絞るため。Ref: [get_template_part()](https://developer.wordpress.org/reference/functions/get_template_part/)
- パーツの側では `isset()` でキーの有無を確かめ、型をそろえてから使う

```php
// 呼び出す側
get_template_part('template-parts/section/hero', null, [
    'title' => __('見出し', 'my-theme'),
    'cta'   => ['label' => __('詳しく見る', 'my-theme'), 'url' => home_url('/about/')],
]);

// パーツの側
$title = isset($args['title']) ? (string) $args['title'] : '';
$cta   = isset($args['cta']) && is_array($args['cta']) ? $args['cta'] : null;
```

| ディレクトリ | 置くもの |
| --- | --- |
| `template-parts/section/` | 複数のページで使うセクション（ヒーロー・CTA の帯など） |
| `template-parts/components/` | セクションの中で使う小さな部品（カード・ボタンなど） |
| `template-parts/content/` | ループの中の 1 件分の表示 |
| `template-parts/header/`・`template-parts/footer/` | ヘッダー・フッターの部品 |

## テンプレートの中の繰り返し

同じ形の繰り返しは、表示するデータを配列にまとめて `foreach` で回し、マークアップを重複させない。

- 1 つのページだけの繰り返しは、そのテンプレートの中の `foreach` でよい。複数のページで使うなら `template-parts/` に分ける
- 配列はループの直前に定義し、データと出力を近くに置く
- 翻訳する文言は、配列を定義する側で `__('文言', 'my-theme')` と書き、出力するときに `esc_html()` を掛ける
- ループで出す値も、必ずエスケープする
- 例外として、開発者が直接書いたインラインの SVG だけは、エスケープせずに出してよい。DB・メタ・利用者の入力は対象外
- インラインの SVG に `wp_kses` 系の関数を掛けない。`viewBox` などの大文字を含む属性名が小文字になり、表示が崩れるため

```php
$features = [
    [
        'icon'  => '<svg viewBox="0 0 24 24" aria-hidden="true">...</svg>', // 開発者が書いた SVG（DB の値ではない）
        'title' => __('見出し', 'my-theme'),
        'desc'  => __('説明', 'my-theme'),
    ],
];
foreach ($features as $feature) : ?>
    <li>
        <?php echo $feature['icon']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- 開発者が書いた SVG のため ?>
        <h3><?php echo esc_html($feature['title']); ?></h3>
        <p><?php echo esc_html($feature['desc']); ?></p>
    </li>
<?php endforeach;
```

## クエリとループ

- メインのクエリを変えるときは、`query_posts()` ではなく `pre_get_posts` のフックを使う。`query_posts()` はメインのクエリを丸ごと置き換え、問題を起こしやすいため。Ref: [query_posts()](https://developer.wordpress.org/reference/functions/query_posts/)
- 別の投稿の一覧は `WP_Query`・`get_posts()` で取る。`WP_Query` のループの後は `wp_reset_postdata()` を呼ぶ
- ループの中で新しい `WP_Query` を作らない。投稿の数だけ DB への問い合わせが増えるため
- `posts_per_page` を必ず指定し、`-1`（全件）を使わない
- ページ送りが要らないときは `'no_found_rows' => true`、ID だけ要るときは `'fields' => 'ids'` を指定する
- タームやメタを使わないときは `'update_post_term_cache' => false`・`'update_post_meta_cache' => false` を指定する

```php
$items = new WP_Query([
    'post_type'      => 'post',
    'posts_per_page' => 3,
    'no_found_rows'  => true,
]);
if ($items->have_posts()) :
    while ($items->have_posts()) :
        $items->the_post();
        get_template_part('template-parts/content/entry');
    endwhile;
endif;
wp_reset_postdata();
```

## ページテンプレートの構造

- `get_header()` → セクション → `get_footer()` の順に書く
- PHP と HTML を混ぜる箇所は、代替構文（`if () :` / `endif;`、`foreach () :` / `endforeach;`）で書く
- 管理画面のテンプレートの選択肢に出すときだけ、`Template Name:` を書く。スラッグで自動的に使われる `page-<スラッグ>.php` では書かない

```php
<?php
/**
 * Page template: About (/about/)
 *
 * @package My_Theme
 */

get_header();
?>

<main id="primary" class="site-main">
    <?php if ($condition) : ?>
        ...
    <?php endif; ?>
</main>

<?php
get_footer();
```

## アセットの読み込みと参照

- CSS・JS は `inc/enqueue.php` の `wp_enqueue_style()`・`wp_enqueue_script()` で読み込み、テンプレートに `<link>`・`<script>` を直接書かない
- テーマ内のファイルの URL は `get_theme_file_uri()` で、パスは `get_theme_file_path()` で取る

```php
<img src="<?php echo esc_url(get_theme_file_uri('assets/images/hero.jpg')); ?>" alt="">
```

## 名前

- テーマと mu-plugins で定義する関数には `my_theme_`、定数には `MY_THEME_` を付ける。WordPress 本体やプラグインと名前がぶつからないようにするため
- Lint の接頭辞の規則は有効にしていない（理由は `phpcs.xml.dist`）。名前を付けるときに、このルールで守る

## PHPDoc

[PHP Documentation Standards](https://developer.wordpress.org/coding-standards/inline-documentation-standards/php/) に従う。すべての PHP ファイルと関数に DocBlock を置く。

- 要約は英語で書く。関数は三人称単数の動詞で始め（`Returns`・`Registers` など）、ピリオドで終える。ファイルの先頭の要約にはピリオドを付けない
- `@package` は `My_Theme` にする
- 戻り値の無い関数には `@return` を書かない。`@return void` は、WordPress 本体の標準テーマ以外では使わないため
- タグの順は `@global` → `@param` → `@return`

```php
/**
 * Returns the label of the given post type.
 *
 * @param string $post_type 投稿タイプのスラッグ。
 * @return string 表示名。投稿タイプが無ければ空文字。
 */
function my_theme_post_type_label($post_type) {
```

テンプレートパーツの `$args` は、`@var` と `@type` で全キーを書く。

```php
/**
 * Hero section
 *
 * @package My_Theme
 *
 * @var array<string,mixed> $args {
 *     @type string     $title 見出し。
 *     @type array|null $cta   ボタン {label, url}（任意）。
 * }
 */
```

## Lint

- PHP を直したら、`wordpress/` で `composer lint` を実行し、指摘を直す。`composer lint:fix` で直せるものは自動で直る
- 指摘を `phpcs:ignore` で消すときは、規則の名前と理由を同じ行に書く（上の SVG の例）
- 規則を外す・足すときは `phpcs.xml.dist` を直し、理由をコメントに書く

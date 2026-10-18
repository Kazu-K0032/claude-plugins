---
paths:
  - "wordpress/**/*.php"
  - "wordpress/seed/**"
  - "wordpress/compose.yaml"
---

# WordPress のテンプレートの書き方に関するルール

テーマのテンプレート（固定の文言・テンプレートパーツ・繰り返し・クエリ・ページテンプレート・アセットの読み込み）の書き方を決める。Lint では見つけられず、書き方がばらつくと、翻訳する文字列の抜き出し・値の出どころ・DB への問い合わせの数に影響するため。Text Domain などの固有の値は、`wordpress.md` にある。

## 固定の文言を書く場合（国際化）

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

## テンプレートパーツを作る場合

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
$heading = isset($args['title']) ? (string) $args['title'] : '';
$cta     = isset($args['cta']) && is_array($args['cta']) ? $args['cta'] : null;
```

| ディレクトリ | 置くもの |
| --- | --- |
| `template-parts/section/` | 複数のページで使うセクション（ヒーロー・CTA の帯など） |
| `template-parts/components/` | セクションの中で使う小さな部品（カード・ボタンなど） |
| `template-parts/content/` | ループの中の 1 件分の表示 |
| `template-parts/header/`・`template-parts/footer/` | ヘッダー・フッターの部品 |

## テンプレートの中で繰り返す場合

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

## 投稿のクエリとループを書く場合

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

## ページテンプレートを作る場合

- `get_header()` → セクション → `get_footer()` の順に書く
- PHP と HTML を混ぜる箇所は、代替構文（`if () :` / `endif;`、`foreach () :` / `endforeach;`）で書く
- 管理画面のテンプレートの選択肢に出すときだけ、`Template Name:` を書く。スラッグで自動的に使われる `page-<スラッグ>.php` では書かない

```php
<?php
/**
 * 固定ページ：会社概要（/about/）
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

## CSS・JS・画像を読み込む場合

- CSS・JS は `inc/enqueue.php` の `wp_enqueue_style()`・`wp_enqueue_script()` で読み込み、テンプレートに `<link>`・`<script>` を直接書かない
- テーマ内のファイルの URL は `get_theme_file_uri()` で、パスは `get_theme_file_path()` で取る

```php
<img src="<?php echo esc_url(get_theme_file_uri('assets/images/hero.jpg')); ?>" alt="">
```

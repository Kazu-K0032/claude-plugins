---
paths:
  - "wordpress/**/*.php"
  - "wordpress/seed/**"
  - "wordpress/compose.yaml"
---

# WordPress の出力と入力に関するルール

WordPress のテーマと mu-plugins で、画面に出す値のエスケープと、利用者から受け取る値の検証を決める。利用者が書き換えられる値を、確かめないまま出したり使ったりしないため。Text Domain（`my-theme`）などの固有の値は `.claude/rules/wordpress.md` にある。

## 値を画面に出す場合

画面に出す値は、出力する直前にエスケープする。早めにエスケープした変数は、後で使い道が変わったときに誤ったエスケープのまま出てしまうため。Ref: [Escaping Data](https://developer.wordpress.org/apis/security/escaping/)

| 出力する場所 | 固定の文言（翻訳あり） | DB・変数の値（翻訳なし） |
| --- | --- | --- |
| タグの中身 | `esc_html_e('文言', 'my-theme')` | `echo esc_html($value)` |
| `href`・`src` | — | `echo esc_url($url)` |
| そのほかの属性 | `esc_attr_e('文言', 'my-theme')` | `echo esc_attr($value)` |
| HTML を含む本文 | — | `echo wp_kses_post($html)` |
| `<script>` の中の値 | — | `echo wp_json_encode($value)` |
| `onclick` などの JS の属性 | — | `echo esc_js($value)` |

- `echo $value` と直接書かない。必ずエスケープの関数を通す
- `get_post_meta()`・`get_option()` の戻り値はエスケープされていない
- JavaScript へ値を渡すときは、`data-*` 属性（`esc_attr()`）か `wp_add_inline_script()` で渡す。`onclick` などの属性に値を埋め込むと、`esc_attr()` では JavaScript として安全にならないため。埋め込むときは `esc_js()` を使う。Ref: [esc_js()](https://developer.wordpress.org/reference/functions/esc_js/)
- テンプレートタグは、出す場所で使い分ける

| 出力する値 | タグの中身 | 属性 |
| --- | --- | --- |
| タイトル | `echo esc_html(get_the_title())` | `the_title_attribute()` |
| パーマリンク | — | `the_permalink()`（中で `esc_url()` 済み）・`echo esc_url(get_permalink())` |
| 本文 | `the_content()`（`esc_html()` を掛けない） | — |

## 入力を受け取る場合

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

$subject = isset($_POST['subject']) ? sanitize_text_field(wp_unslash($_POST['subject'])) : '';
```

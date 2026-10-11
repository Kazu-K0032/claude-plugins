<?php
/**
 * テーマの初期設定
 *
 * @package My_Theme
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * テーマの機能・メニュー・翻訳ファイルを登録する。
 */
function my_theme_setup() {
    load_theme_textdomain('my-theme', get_template_directory() . '/languages');

    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', [
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script',
    ]);
    add_theme_support('responsive-embeds');

    register_nav_menus([
        'primary' => __('メインメニュー', 'my-theme'),
        'footer'  => __('フッターメニュー', 'my-theme'),
    ]);
}
add_action('after_setup_theme', 'my_theme_setup');

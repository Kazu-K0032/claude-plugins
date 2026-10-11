<?php
/**
 * Asset enqueue
 *
 * CSS・JS は wp_enqueue_* で読み込み、テンプレートに <link>・<script> を直接書かない。
 * WordPress に任せると、依存する順に並べ、同じファイルを二重に読み込まないため。プラグインからも差し替えられる。
 *
 * @package My_Theme
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Enqueues the theme stylesheet.
 */
function my_theme_enqueue_assets() {
    wp_enqueue_style('my-theme', get_stylesheet_uri(), [], MY_THEME_VERSION);
}
add_action('wp_enqueue_scripts', 'my_theme_enqueue_assets');

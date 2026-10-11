<?php
/**
 * テーマの読み込みの入口
 *
 * テーマを差し替えても失われては困る処理（投稿タイプの登録など）は mu-plugins に置く。
 * ここでは inc/ のファイルを読み込むだけにし、処理を直接書かない。
 *
 * @package My_Theme
 */

if (!defined('ABSPATH')) {
    exit;
}

// CSS・JS の URL に付ける版。ファイルを直したら上げ、ブラウザのキャッシュを捨てさせる
define('MY_THEME_VERSION', '0.1.0');

require_once get_template_directory() . '/inc/setup.php';
require_once get_template_directory() . '/inc/enqueue.php';

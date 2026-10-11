<?php
/**
 * 全ページ共通のフッター
 *
 * @package My_Theme
 */

?>
<footer class="site-footer">
    <?php
    wp_nav_menu([
        'theme_location' => 'footer',
        'container'      => 'nav',
        'fallback_cb'    => false,
    ]);
    ?>
    <p>&copy; <?php echo esc_html(wp_date('Y')); ?> <?php bloginfo('name'); ?></p>
</footer>
<?php wp_footer(); ?>
</body>
</html>

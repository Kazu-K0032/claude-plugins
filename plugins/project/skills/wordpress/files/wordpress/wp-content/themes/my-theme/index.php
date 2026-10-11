<?php
/**
 * ほかのテンプレートが無いページの表示
 *
 * single.php・page.php などを足すと、そのページはそちらで表示される。
 *
 * @package My_Theme
 */

get_header();
?>

<main id="primary" class="site-main">
    <?php if (have_posts()) : ?>
        <?php
        while (have_posts()) :
            the_post();
            get_template_part('template-parts/content/entry');
        endwhile;

        the_posts_navigation();
        ?>
    <?php else : ?>
        <?php get_template_part('template-parts/content/none'); ?>
    <?php endif; ?>
</main>

<?php
get_footer();

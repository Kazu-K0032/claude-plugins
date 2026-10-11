<?php
/**
 * ループの中の 1 件分の表示
 *
 * @package My_Theme
 */

?>
<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
    <h2 class="entry-title">
        <a href="<?php the_permalink(); ?>"><?php echo esc_html(get_the_title()); ?></a>
    </h2>
    <div class="entry-summary">
        <?php the_excerpt(); ?>
    </div>
</article>

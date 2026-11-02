<?php
/** Local development only: suppress outbound WordPress email, not a catalog security plugin. */
add_filter('pre_wp_mail', '__return_false');

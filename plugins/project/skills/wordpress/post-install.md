# 導入後の残作業

手順 10 で、導入後の残作業を利用者に提示するときに読む。済んでいる項目は省く。コマンドは人が実行する。

導入後の Lint には PHP と Composer が、Docker のローカル環境には Docker と Docker Compose が要る（このスキル自体はどちらも使わない）。

1. `wordpress/` で `composer install` を実行し、`composer lint` で検査できることを確かめる
1. `style.css` の `Description`・`Requires at least`・`Requires PHP`、`phpcs.xml.dist` の `testVersion`・`minimum_wp_version`、`compose.yaml` のイメージのタグを、本番の WordPress・PHP・DB の版に合わせる
1. Docker の雛形を入れた場合は、`wordpress/` でローカル環境を起動し、`http://localhost:8080` が開けることを確かめる。ポートを変えるときは、`.env.example` を `.env` にコピーして `WORDPRESS_PORT` を直す

    ```bash
    docker compose up -d
    ```

1. Docker の雛形を入れた場合は、WP-CLI で WordPress の初期設定をし、テーマを有効にする。`--admin_password` を省くと、パスワードが自動で作られて画面に出る

    ```bash
    docker compose run --rm cli wp core install --url=http://localhost:8080 --title="<サイト名>" --admin_user=<ユーザー名> --admin_email=<メールアドレス>
    docker compose run --rm cli wp theme activate <スラッグ>
    ```

1. Docker の雛形を入れなかった場合は、WordPress を動かす環境でテーマを有効にする。ローカル環境を作るときは、規約（`wordpress.md`）の「ローカル環境を整える場合」に沿う
1. `CLAUDE.md` があれば、「ディレクトリ」に `wordpress/` を足し、「反映されない」と判断する前の配信経路に、有効なテーマとマウント元（`wordpress/compose.yaml` など）を書く。ルートの `README.md` から `wordpress/README.md` へ案内する
1. 手順 8 でフックに足さなかった場合は、PHP の Lint と Docker の検出をフックで動かすかを決める
1. 手順 8 で、古い形のフックのまま `lefthook.yml` に足した場合は、`/project:init-repo` を実行して `post-edit-lint.sh` を上書きする。上書きするまで、足した定義は動かない
1. 手順 9 で ADR の一覧が無かった場合は、足した ADR を一覧に載せるかを決める
1. プラグインを Git で管理している場合は、`.gitignore` と規約のプラグインの行を、管理する前提に直したことを伝える

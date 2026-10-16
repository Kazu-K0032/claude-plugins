---
name: wordpress
description: WordPress のリポジトリに、wordpress/wp-content/ 配下のテーマ（クラシックテーマの最小構成）と mu-plugins の置き場所、Docker のローカル環境（MySQL・WordPress・WP-CLI。入れるかは実行時に聞く）、PHP の Lint（phpcs）の設定、置き場所・出力のエスケープ・入力の検証・国際化などをまとめた規約（.claude/rules/wordpress.md）を導入する。WordPress のプロジェクトを立ち上げる時、または既存の WordPress リポジトリへ規約と Lint を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*), Bash(date:*), Bash(git ls-files:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象で、Docker は実行時に聞く。例: 規約だけ / Lint だけ / Docker なし / 既存は置き換えない）]"
---

# WordPress プロジェクトのセットアップ（wordpress）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/`）を、実行中のリポジトリのルートへコピーし、テーマの仮の名前（`my-theme` など）を利用者が決めた名前に置き換える。**既存ファイルは承認なしに上書きしない**。

Markdown の書式は `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` を Read し、その規約に従う。

## 参照ファイル

| ファイル | 役割 |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` | 状態判定（NEW / SAME / DIFF）とコピーの実行。project プラグインの全 Skill で共有するため、`--skill wordpress` で対象を指定する |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/` | コピー元のテンプレート一式 |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/.claude/rules/wordpress.md` | 置き場所と実装の規約（既存の構成に合わせて書き換えるときの元にもする） |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/adr/php-coding-standards.md` | Lint の規則（WPCS を使い、整形の規則だけ外す）を決めた理由の ADR。手順 9 で利用先の ADR の置き場所に書く |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/README.md` | 収録物の一覧・除外したものとその理由 |

## 前提条件

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること
- 導入後の Lint には PHP と Composer が、Docker のローカル環境には Docker と Docker Compose が要る（このスキル自体はどちらも使わない）
- `.claude/settings.json`・`CLAUDE.md` などの土台（`/project:init-repo`）は必須ではない。無ければ手順 1 で、先に入れるかを聞く。土台の `.claude/hooks/post-edit-lint.sh` があれば、手順 8 で PHP の Lint を足す

## 引数の解釈

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、Docker のローカル環境は手順 2 で聞く。`DIFF` は手順 6 で 1 件ずつ判断してもらう。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/wordpress.md` だけ |
| `Lint だけ` | `wordpress/composer.json`・`wordpress/phpcs.xml.dist` だけ（手順 8 のフックも対象）。`vendor/`・`auth.json` が Git の対象外になっていなければ、`.gitignore` に足す案を出す |
| `Docker なし` | `wordpress/compose.yaml`・`wordpress/.env.example` を入れない。手順 2 で聞かない |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 6 を飛ばす |

範囲を絞った場合は、`--check` の結果から対象ファイルの相対パスを確定し、手順 4 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。

## 仮の名前

テンプレートは、テーマの名前を次の仮の名前で書いている。手順 5 で、手順 2 で決めた名前に置き換える。A ではすべてをスラッグ（例：`acme-site`）から作り、B・C では既存のテーマから取る。

| 仮の名前 | 置き換え後 | A の例 | 使っている場所 |
| --- | --- | --- | --- |
| `themes/my-theme` | `themes/` とテーマのディレクトリ名 | `themes/acme-site` | テーマのディレクトリ・`compose.yaml` のマウント・`phpcs.xml.dist` の `<file>`・README のリンク・規約のパス |
| `my-theme`（上以外） | Text Domain | `acme-site` | `style.css`・翻訳関数・`phpcs.xml.dist` の Text Domain・`compose.yaml` のプロジェクト名・規約 |
| `my_theme` | 関数の接頭辞（末尾の `_` を除く） | `acme_site` | 関数名・規約 |
| `MY_THEME` | 上を大文字にしたもの | `ACME_SITE` | 定数名・規約 |
| `My_Theme` | `@package` の名前 | `Acme_Site` | `@package`・規約 |
| `My Theme` | テーマの表示名 | `Acme Site` | `style.css` の `Theme Name`・`phpcs.xml.dist` の `ruleset` の名前 |

表の上から順に置き換える。`themes/my-theme` を先に置き換えないと、テーマのディレクトリ名と Text Domain が違うときに、パスを Text Domain で書き換えてしまうため。

## 手順

### 1. 現状を確認する

最初に、土台の `.claude/settings.json` があるかを Glob で確かめる。無ければ、`AskUserQuestion` で聞く。

| 選択肢 | 次の動き |
| --- | --- |
| 先に init-repo を実行する（推奨） | ここで止め、`/project:init-repo` を実行してから `/project:wordpress` を呼び直すよう案内する。どちらも Claude からは呼べないため、利用者が実行する |
| このまま進める | 次の影響を伝えて続ける。`.claude/hooks/post-edit-lint.sh` も無ければ、PHP の Lint をフックで動かせない（Lint の設定と規約は入る）。秘匿ファイルの deny・破壊的な操作を止めるフックも入らない |

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill wordpress --check
```

ラベルの意味は次のとおり。

| ラベル | 意味 |
| --- | --- |
| `NEW` | 導入先に存在しない。コピー対象 |
| `SAME` | 既存ファイルと内容が一致。何もしない |
| `DIFF` | 既存ファイルと内容が異なる。**自動では触らない** |

あわせて、既存の WordPress を Glob で探す。`vendor/`・`node_modules/` は除く。

| 探すもの | パターン |
| --- | --- |
| テーマ | `**/wp-content/themes/*/style.css`（`twenty` で始まる標準のテーマは除く） |
| mu-plugins | `**/wp-content/mu-plugins/*.php` |
| ローカル環境 | `**/compose.yaml`・`**/compose.yml`・`**/docker-compose.yaml`・`**/docker-compose.yml` |
| Lint の設定 | `**/phpcs.xml`・`**/phpcs.xml.dist`・`**/.phpcs.xml.dist`・`**/composer.json` |

あわせて、プラグインを Git で管理しているかを確かめる。`wp-content/plugins/` の下に追跡中のファイルがあれば、管理している。

```bash
git ls-files -- '*wp-content/plugins/*'
```

結果から、次のどれに当たるかを決める。

| 状態 | 扱い |
| --- | --- |
| A：WordPress のファイルが無い | テンプレート全体を入れる。手順 2 でスラッグとローカル環境を決める |
| B：`wordpress/wp-content/` に既存のテーマがある | テーマの雛形（`wordpress/wp-content/themes/my-theme/` 配下）は入れない。`themes/` に 2 つ目のテーマができるため。名前は手順 2 で既存のテーマから調べる。自作のテーマが複数あれば、どれを対象にするかを聞く |
| C：別の場所に既存の構成がある（例：ルート直下の `wp-content/`） | ファイルを動かさない。デプロイ・Docker のマウント・CI が今のパスに依存しているため。`.claude/rules/wordpress.md` だけをコピーし、手順 7 で今の場所に合わせる。テーマの雛形・ローカル環境・README は入れない。名前は B と同じく既存のテーマから調べる |

ローカル環境のファイルが既にある場合は、状態にかかわらず Docker の雛形（`wordpress/compose.yaml`・`wordpress/.env.example`）を入れない。2 つ目の構成ができ、どちらで起動するかが分からなくなるため。

### 2. テーマの名前とローカル環境を決める

A の場合は、利用者にテーマのスラッグと表示名を聞く。スラッグは、テーマのディレクトリ名・Text Domain・関数の接頭辞の元になる。リポジトリ名から作った候補を先に示す。

- 英小文字・数字・ハイフンだけにし、英小文字で始める
- `wp`・`wordpress`・`twenty` で始めない。WordPress 本体や標準のテーマと名前がぶつかるため
- `wordpress/wp-content/themes/` に同じ名前のディレクトリがあれば、別の名前にしてもらう

B・C の場合は、既存のテーマから次の名前を調べる。分からないものは利用者に聞き、推測で埋めない。ディレクトリ名と Text Domain は違ってよい。

| 名前 | 調べ方 |
| --- | --- |
| テーマのディレクトリ名 | `wp-content/themes/` の下の、対象のテーマのディレクトリ名 |
| Text Domain | `style.css` の `Text Domain`。無ければ、翻訳関数の第 2 引数を Grep する |
| 関数の接頭辞 | `functions.php`・`inc/` の `function <接頭辞>_` を Grep する |
| `@package` の名前・表示名 | 既存のファイルの `@package` と、`style.css` の `Theme Name` |

A・B の場合で、ローカル環境のファイルが無く、引数に `Docker なし` も無ければ、Docker でローカル環境を作るかを `AskUserQuestion` で聞く。

| 選択肢 | 扱い |
| --- | --- |
| 作る（推奨） | `wordpress/compose.yaml`・`wordpress/.env.example` を入れる |
| 作らない | 入れない。Local・wp-env など、別の方法で動かす場合 |

### 3. 導入計画を提示して承認を得る（必須）

`--check` の結果を、新規作成するファイル（`NEW`）・既存のまま残すファイル（`SAME`）・衝突していて判断が要るファイル（`DIFF`）に分けて提示する。あわせて、手順 1 の状態（A・B・C）と入れないファイル、手順 2 で決めたローカル環境、手順 5 の置き換え後の名前、手順 8 でフックに PHP の Lint を足すか、手順 9 で ADR を足す場所を示す。

テンプレートの中身を確かめられるよう、`https://github.com/Kazu-K0032/claude-plugins/tree/v<版>/plugins/project/skills/wordpress/files` も示す。`<版>` は `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` の `version` にする。入れている版と同じ中身を見せるため。リリース前の版ではタグが無く、開けない。

### 4. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill wordpress --apply
```

次の場合は、入れるファイルを `--only` に列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

| 場合 | `--only` に並べるもの |
| --- | --- |
| B | テーマの雛形を除いた `NEW` |
| C | `.claude/rules/wordpress.md` だけ |
| Docker の雛形を入れない | `wordpress/compose.yaml`・`wordpress/.env.example` を除いた `NEW` |
| 範囲を絞った | 引数で指定した範囲の `NEW` |

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill wordpress --apply --only .claude/rules/wordpress.md wordpress/composer.json wordpress/phpcs.xml.dist
```

2 回目以降の実行では、手順 5 で名前を変えたテーマは `wordpress/wp-content/themes/my-theme/` 配下が `NEW` に、置き換えたファイルは `DIFF` に出る。テーマの雛形は B と同じく入れず、仮の名前だけの差分は据え置く。

### 5. 仮の名前を置き換える

この実行でコピーしたファイルだけを対象にする。既存のファイルは変えない。

1. A の場合は、テーマのディレクトリの名前を変える。コピーしたばかりで Git の管理外のため、`git mv` ではなく `mv` を使う

    ```bash
    mv wordpress/wp-content/themes/my-theme wordpress/wp-content/themes/<スラッグ>
    ```

1. コピーしたファイルの仮の名前を、「仮の名前」の表に従って置き換える
1. `my-theme`・`my_theme`・`MY_THEME`・`My_Theme`・`My Theme` で Grep し、コピーしたファイルに残っていないことを確かめる
1. `compose.yaml` の `name:` に、Compose のプロジェクト名に使えない文字（大文字など）があれば、小文字にする
1. `phpcs.xml.dist` の `<file>` が指すディレクトリ（テーマ・mu-plugins）があるかを確かめる。無ければ、その行を消すか、ディレクトリを作るかを聞く。無いディレクトリを指すと、`composer lint` がエラーで止まるため
1. Docker の雛形を入れなかった場合は、コピーした `wordpress/README.md` から `compose.yaml`・`.env.example` の行を消す
1. プラグインを Git で管理している場合（手順 1）は、コピーした `wordpress/.gitignore` から `/wp-content/plugins/` の行とその上のコメントを消し、規約の「置き場所」の表のプラグインの行を「Git で管理する」に直す

### 6. 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。テンプレートは仮の名前のままのため、名前だけの差分は差分として扱わない。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/<同じ相対パス>"
```

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `.claude/rules/wordpress.md` | 既存の規約に足りない項目だけを、仮の名前を置き換えてから足す |
| `wordpress/compose.yaml` | 上書きしない。既存のローカル環境を正とする |
| `wordpress/.env.example` | 足りない変数だけを足す |
| `wordpress/composer.json` | 既存を正とする。`require-dev` の 3 つのパッケージ、`config.allow-plugins`、`scripts` の `lint`・`lint:fix` のうち、無いものだけを足す。既にある版は変えない |
| `wordpress/phpcs.xml.dist` | 既存を正とする。外している規則と対象のディレクトリは変えない。`WordPress.WP.I18n` の Text Domain が無ければ、足すことを提案する |
| `wordpress/.gitignore` | 足りない行だけを足す。プラグインを Git で管理している場合（手順 1）は、`/wp-content/plugins/` を足さない |
| README（`wordpress/README.md` など） | 既存の一覧に、足したファイルの行だけを足す |
| テーマのファイル | 上書きしない |

### 7. 今の場所に合わせる（C の場合）

コピーした `.claude/rules/wordpress.md` の、frontmatter の `paths` と、本文の `wordpress/` で始まるパスを、今の構成の場所に書き換える。

Lint の設定（`composer.json`・`phpcs.xml.dist`）と `.gitignore` は、テンプレートを Read し、今の構成の WordPress のルート（`wp-content/` を持つディレクトリ）に作る案を出す。`phpcs.xml.dist` の `<file>` は、今のテーマと mu-plugins のディレクトリにする。既にあるファイルには、手順 6 の方針で足りない分だけを足す。

### 8. Lint のフックに PHP を足す

`.claude/hooks/post-edit-lint.sh` があり、`phpcs` を呼ぶブロックが無ければ、次のブロックを足す案を差分で示し、承認を得てから足す。C の場合は `PHP_LINT_DIR` と `case` のパスを今の場所に合わせる。

```bash
# PHP: phpcs（WordPress のコーディング規約）。設定は PHP_LINT_DIR の phpcs.xml.dist
# 検査するのは、phpcs.xml.dist の <file> と同じく、テーマと mu-plugins だけ
PHP_LINT_DIR="wordpress"
case "$file_path" in
  "$PHP_LINT_DIR"/wp-content/themes/*.php | "$PHP_LINT_DIR"/wp-content/mu-plugins/*.php)
    if [ -x "$PHP_LINT_DIR/vendor/bin/phpcs" ]; then
      result=$( (cd "$PHP_LINT_DIR" && ./vendor/bin/phpcs -q "${file_path#"$PHP_LINT_DIR"/}" 2>&1) || true)
      if [ -n "$result" ]; then
        report+="⚠️  phpcs: $file_path"$'\n'"$result"$'\n'
      fi
    fi
    finish
    ;;
esac
```

足す場所は、フックの形で決める。

| フックの形 | 足す場所 |
| --- | --- |
| `[ -d "$LINT_DIR/node_modules/.bin" ] \|\| finish` の行がある（古い `init-repo` の形） | その行より前。後ろに足すと、Node を使わないリポジトリでブロックまで届かないため |
| 上の行が無く、`# --- 言語別チェック` の区切りがある | 区切りのすぐ後ろ |
| `report`・`finish` を使っていない（`init-repo` 以外の形） | 書き換えず、上のブロックを示して、利用者に足し方を決めてもらう |

フックが無い場合は、手順 10 で、`/project:init-repo` で入れられることを伝える。

### 9. Lint の規則を決めた理由を ADR に足す

この実行で `phpcs.xml.dist` を入れた場合は、`${CLAUDE_PLUGIN_ROOT}/skills/wordpress/adr/php-coding-standards.md` を元に、規則を決めた理由を ADR として足す。あとから「なぜ整形の規則を外したか」を確かめられるようにするため。`phpcs.xml.dist` を入れていなければ飛ばす。

1. ADR の置き場所を決める。`CLAUDE.md`・`.claude/rules/` に置き場所があればそこにする。無ければ `docs/adr/`・`doc/adr/`・`docs/decisions/`・`adr/` を Glob で探す。どれも無ければ、`AskUserQuestion` で「置き場所の候補・ADR を作らない」から選んでもらう。推測した場所には置かない
1. 置き場所に `*-php-coding-standards.md` が既にあれば、足さない
1. `date +%Y-%m-%d` で今日の日付を取る。元の ADR を Read し、`YYYY-MM-DD` を今日の日付に、仮の名前を「仮の名前」の表に従って置き換え、`<置き場所>/<日付>-php-coding-standards.md` に書く
1. 置き場所の一覧（`README.md`）の表に 1 行足す。題は ADR の見出しの `# ADR <日付>:` より後ろにし、状態は `承認済み` にする。表の列が違えば、今の一覧の形に合わせる。一覧が無ければ作らず、手順 10 で伝える

### 10. 導入後にやることを伝える

コピーが終わったら、次を残作業としてユーザーに提示する。済んでいる項目は省く。コマンドは人が実行する。最後に、手順 3 と同じテンプレートのリンクを添える。

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

1. Docker の雛形を入れなかった場合は、WordPress を動かす環境でテーマを有効にする。ローカル環境を作るときは、規約の「ローカル環境」に沿う
1. `CLAUDE.md` があれば、「ディレクトリ」に `wordpress/` を足し、「反映されない」と判断する前の配信経路に、有効なテーマとマウント元（`wordpress/compose.yaml` など）を書く。ルートの `README.md` から `wordpress/README.md` へ案内する
1. 手順 8 でフックに足さなかった場合は、PHP の Lint をフックで動かすかを決める
1. 手順 9 で ADR の一覧が無かった場合は、足した ADR を一覧に載せるかを決める
1. プラグインを Git で管理している場合は、`.gitignore` と規約のプラグインの行を、管理する前提に直したことを伝える

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存のテーマ・mu-plugins のファイルを移動・改名しない
- `composer`・`docker`（`docker compose` を含む）・`wp`（WP-CLI）と、本番への反映（FTP・rsync など）を実行しない。依存やイメージの取得・DB の書き換え・本番の変更を伴うため、人が実行する
- コピー結果をコミットしない（コミットは人が行う）
- ファイルを消さない

$ARGUMENTS

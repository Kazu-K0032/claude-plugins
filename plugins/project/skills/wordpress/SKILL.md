---
name: wordpress
description: WordPress のリポジトリに、wordpress/wp-content/ 配下のテーマ（クラシックテーマの最小構成）と mu-plugins の置き場所、PHP の Lint（phpcs）の設定、置き場所・出力のエスケープ・入力の検証・国際化などをまとめた規約（.claude/rules/wordpress.md）を導入する。WordPress のプロジェクトを立ち上げる時、または既存の WordPress リポジトリへ規約と Lint を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象。例: 規約だけ / Lint だけ / 既存は置き換えない）]"
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
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/README.md` | 収録物の一覧・除外したものとその理由 |

## 前提条件

- リポジトリの**ルート**で実行すること（サブディレクトリで実行するとスクリプトが停止する）
- `git` / `bash` が利用可能であること
- 導入後の Lint には PHP と Composer が要る（このスキル自体は Composer を使わない）
- `.claude/settings.json`・`CLAUDE.md` などの土台も要るなら、先に `/project:init-repo` を実行しておく（必須ではない）。土台の `.claude/hooks/post-edit-lint.sh` があれば、手順 8 で PHP の Lint を足す

## 引数の解釈

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、`DIFF` は手順 6 で 1 件ずつ判断してもらう。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/wordpress.md` だけ |
| `Lint だけ` | `wordpress/composer.json`・`wordpress/phpcs.xml.dist` だけ（手順 8 のフックも対象） |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 6 を飛ばす |

範囲を絞った場合は、`--check` の結果から対象ファイルの相対パスを確定し、手順 4 で `--only` に列挙する。`--only` に `DIFF` のファイルを含めると上書きになるため、**列挙するのは `NEW` のファイルだけ**にする。

## 仮の名前

テンプレートは、テーマの名前を次の仮の名前で書いている。手順 5 で、利用者が決めたスラッグ（例：`acme-site`）から作った名前に置き換える。

| 仮の名前 | 置き換え後 | 例 | 使っている場所 |
| --- | --- | --- | --- |
| `my-theme` | スラッグ | `acme-site` | テーマのディレクトリ名・Text Domain・`phpcs.xml.dist`・README・規約 |
| `my_theme` | スラッグの `-` を `_` にしたもの | `acme_site` | 関数名・規約 |
| `MY_THEME` | 上を大文字にしたもの | `ACME_SITE` | 定数名・規約 |
| `My_Theme` | 単語の先頭を大文字にし、`_` でつないだもの | `Acme_Site` | `@package`・規約 |
| `My Theme` | テーマの表示名（利用者が指定しなければ、単語の先頭を大文字にし、空白でつないだもの） | `Acme Site` | `style.css` の `Theme Name`・`phpcs.xml.dist` の `ruleset` の名前 |

## 手順

### 1. 現状を確認する

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
| Lint の設定 | `**/phpcs.xml`・`**/phpcs.xml.dist`・`**/.phpcs.xml.dist`・`**/composer.json` |

結果から、次のどれに当たるかを決める。

| 状態 | 扱い |
| --- | --- |
| A：WordPress のファイルが無い | テンプレート全体を入れる。手順 2 でスラッグを決める |
| B：`wordpress/wp-content/` に既存のテーマがある | テーマの雛形（`wordpress/wp-content/themes/my-theme/` 配下）は入れない。`themes/` に 2 つ目のテーマができるため。既存のテーマの `style.css` の `Text Domain` をスラッグとして使う。自作のテーマが複数あれば、どれを対象にするかを聞く |
| C：別の場所に既存の構成がある（例：ルート直下の `wp-content/`） | ファイルを動かさない。デプロイ・Docker のマウント・CI が今のパスに依存しているため。`.claude/rules/wordpress.md` だけをコピーし、手順 7 で今の場所に合わせる。テーマの雛形と README は入れない。スラッグは B と同じく既存のテーマから取る |

### 2. テーマのスラッグを決める（A の場合）

利用者に、テーマのスラッグと表示名を聞く。スラッグは、テーマのディレクトリ名・Text Domain・関数の接頭辞の元になる。リポジトリ名から作った候補を先に示す。

- 英小文字・数字・ハイフンだけにし、英小文字で始める
- `wp`・`wordpress`・`twenty` で始めない。WordPress 本体や標準のテーマと名前がぶつかるため
- `wordpress/wp-content/themes/` に同じ名前のディレクトリがあれば、別の名前にしてもらう

### 3. 導入計画を提示して承認を得る（必須）

`--check` の結果を、新規作成するファイル（`NEW`）・既存のまま残すファイル（`SAME`）・衝突していて判断が要るファイル（`DIFF`）に分けて提示する。あわせて、手順 1 の状態（A・B・C）と入れないファイル、手順 5 の置き換え後の名前、手順 8 でフックに PHP の Lint を足すかを示す。

### 4. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill wordpress --apply
```

B・C の場合と、範囲を絞った場合は、入れるファイルを `--only` に列挙する。B ではテーマの雛形を除いた `NEW`、C では `.claude/rules/wordpress.md` だけを並べる。`--only` は「差分を承知で上書きする」という明示指定として扱われる。

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

1. コピーしたファイルの仮の名前を、「仮の名前」の表に従って置き換える。B・C では、既存のテーマから取ったスラッグで置き換える
1. `my-theme`・`my_theme`・`MY_THEME`・`My_Theme`・`My Theme` で Grep し、コピーしたファイルに残っていないことを確かめる

### 6. 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。テンプレートは仮の名前のままのため、名前だけの差分は差分として扱わない。

```bash
diff -u <既存ファイル> "${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/<同じ相対パス>"
```

ファイル別のマージ方針は次のとおり。

| ファイル | マージ方針 |
| --- | --- |
| `.claude/rules/wordpress.md` | 既存の規約に足りない項目だけを、仮の名前を置き換えてから足す |
| `wordpress/composer.json` | 既存を正とする。`require-dev` の 3 つのパッケージ、`config.allow-plugins`、`scripts` の `lint`・`lint:fix` のうち、無いものだけを足す。既にある版は変えない |
| `wordpress/phpcs.xml.dist` | 既存を正とする。外している規則と対象のディレクトリは変えない。`WordPress.WP.I18n` の Text Domain が無ければ、足すことを提案する |
| `wordpress/.gitignore` | 足りない行だけを足す。プラグインを Git で管理しているリポジトリには `/wp-content/plugins/` を足さない |
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

フックが無い場合は、手順 9 で、`/project:init-repo` で入れられることを伝える。

### 9. 導入後にやることを伝える

コピーが終わったら、次を残作業としてユーザーに提示する。済んでいる項目は省く。

1. `wordpress/` で `composer install` を実行し、`composer lint` で検査できることを確かめる
1. `style.css` の `Description`・`Requires at least`・`Requires PHP` と、`phpcs.xml.dist` の `testVersion`・`minimum_wp_version` を、本番の WordPress と PHP の版に合わせる
1. WordPress を動かす環境で、テーマを有効にする。ローカル環境を作るときは、規約の「ローカル環境」に沿う
1. `CLAUDE.md` があれば、「ディレクトリ」に `wordpress/` を足し、「反映されない」と判断する前の配信経路に、有効なテーマとマウント元を書く。ルートの `README.md` から `wordpress/README.md` へ案内する
1. 手順 8 でフックに足さなかった場合は、PHP の Lint をフックで動かすかを決める

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存のテーマ・mu-plugins のファイルを移動・改名しない
- `composer`・`docker`・`wp`（WP-CLI）と、本番への反映（FTP・rsync など）を実行しない。依存の取得・DB の書き換え・本番の変更を伴うため、人が実行する
- コピー結果をコミットしない（コミットは人が行う）
- ファイルを消さない

$ARGUMENTS

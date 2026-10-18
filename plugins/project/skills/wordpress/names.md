# テーマの名前と仮の名前の置き換え

手順 2 でテーマの名前を決めるとき、手順 5 で仮の名前を置き換えるときに読む。

## テーマの名前を決める（手順 2）

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

## 仮の名前を置き換える（手順 5）

1. A の場合は、テーマのディレクトリの名前を変える。コピーしたばかりで Git の管理外のため、`git mv` ではなく `mv` を使う

    ```bash
    mv wordpress/wp-content/themes/my-theme wordpress/wp-content/themes/<スラッグ>
    ```

1. コピーしたファイルの仮の名前を、「仮の名前」の表に従って置き換える
1. `my-theme`・`my_theme`・`MY_THEME`・`My_Theme`・`My Theme` で Grep し、コピーしたファイルに残っていないことを確かめる
1. `compose.yaml` の `name:` に、Compose のプロジェクト名に使えない文字（大文字など）があれば、小文字にする
1. `phpcs.xml.dist` の `<file>` が指すディレクトリ（テーマ・mu-plugins）があるかを確かめる。無ければ、その行を消すか、ディレクトリを作るかを聞く。無いディレクトリを指すと、`composer lint` がエラーで止まるため
1. Docker の雛形を入れなかった場合は、コピーした `wordpress/README.md` から `compose.yaml`・`.env.example` の行を消す
1. プラグインを Git で管理している場合（手順 1）は、コピーした `wordpress/.gitignore` から `/wp-content/plugins/` の行とその上のコメントを消し、規約（`wordpress.md`）の「ファイルを置く場合」の表のプラグインの行を「Git で管理する」に直す

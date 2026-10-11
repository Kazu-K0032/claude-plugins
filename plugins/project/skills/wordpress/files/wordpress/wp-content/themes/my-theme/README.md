# my-theme

## このディレクトリは何か

このサイトのテーマ（見た目と表示の処理）を置く場所。テーマを替えても残す処理（投稿タイプの登録など）は、[mu-plugins](../../mu-plugins/README.md) に置く。

## いつ読むか

- テンプレート・CSS・JS を足す・直すとき
- どのテンプレートがどのページを表示するかを確かめるとき

## ファイル一覧

| ファイル | 内容 |
| --- | --- |
| [style.css](style.css) | テーマの情報（名前・版・Text Domain） |
| [functions.php](functions.php) | `inc/` のファイルを読み込む入口 |
| [inc/setup.php](inc/setup.php) | テーマの機能・メニューの登録 |
| [inc/enqueue.php](inc/enqueue.php) | CSS・JS の読み込み |
| [header.php](header.php)・[footer.php](footer.php) | 全ページ共通のヘッダー・フッター |
| [index.php](index.php) | ほかのテンプレートが無いページの表示 |
| [template-parts/](template-parts/) | 複数のテンプレートで使う部品 |

## 書き方

規約は [.claude/rules/wordpress.md](../../../../.claude/rules/wordpress.md) にある。

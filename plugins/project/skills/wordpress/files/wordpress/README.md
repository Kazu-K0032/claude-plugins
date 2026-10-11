# wordpress

## このディレクトリは何か

WordPress のうち、このリポジトリで管理するもの（テーマ・mu-plugins・ローカル環境と PHP の Lint の設定）を置く場所。WordPress 本体・アップロードした画像・サードパーティのプラグインは管理しない。

## いつ読むか

- テーマ・mu-plugins を足す・直すとき
- ローカル環境・PHP の Lint の設定を確かめるとき

## ファイル一覧

| ファイル | 内容 |
| --- | --- |
| [wp-content/themes/my-theme/](wp-content/themes/my-theme/README.md) | テーマ |
| [wp-content/mu-plugins/](wp-content/mu-plugins/README.md) | テーマを替えても残す処理（投稿タイプの登録など） |
| [compose.yaml](compose.yaml) | ローカル環境（MySQL・WordPress・WP-CLI の Docker） |
| [.env.example](.env.example) | ローカル環境の DB の接続情報とポートの雛形 |
| [composer.json](composer.json) | PHP の Lint のツール（`composer lint` で検査、`composer lint:fix` で直せるものを直す） |
| [phpcs.xml.dist](phpcs.xml.dist) | Lint の規則（WordPress のコーディング規約） |
| [.gitignore](.gitignore) | Git で管理しないもの |

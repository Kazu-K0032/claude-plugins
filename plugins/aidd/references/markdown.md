# Markdown コーディング規約

markdownlint（vscode-markdownlint）のルールに準拠する。

## 見出し（Heading）

- **MD001** heading-increment: 見出しレベルは1つずつ増やすこと（レベルを飛ばさない）
- **MD003** heading-style: 見出しスタイルはATX形式（`#`）で統一すること
- **MD018** no-missing-space-atx: `#`の後にスペースを入れること
- **MD019** no-multiple-space-atx: `#`の後のスペースは1つだけにすること
- **MD022** blanks-around-headings: 見出しの前後に空行を1行ずつ配置すること
- **MD023** heading-start-left: 見出しは行頭から始めること
- **MD024** no-duplicate-heading: 同じ内容の見出しを複数使用しないこと
- **MD025** single-h1: トップレベル見出し（`#`）はドキュメント内に1つだけにすること
- **MD026** no-trailing-punctuation: 見出し末尾に句読点を付けないこと

## リスト（List）

- **MD004** ul-style: 順序なしリストのマーカーは`-`で統一すること
- **MD005** list-indent: 同じレベルのリスト項目のインデントを揃えること
- **MD007** ul-indent: ネストされたリストのインデントはスペース2つにすること
- **MD029** ol-prefix: 順序付きリストのプレフィックスは`1.`で統一すること
- **MD030** list-marker-space: リストマーカーの後のスペースは1つにすること
- **MD032** blanks-around-lists: リストの前後に空行を1行ずつ配置すること

## コードブロック（Code Block）

- **MD031** blanks-around-fences: コードブロックの前後に空行を1行ずつ配置すること
- **MD040** fenced-code-language: コードブロックには必ず言語を指定すること。中身の内容に最も合致する言語を選ぶこと（下記の選定基準を参照）
- **MD046** code-block-style: コードブロックのスタイルはfenced（` ``` `）で統一すること
- **MD048** code-fence-style: コードフェンスのスタイルはバッククォート（` ``` `）で統一すること

### コードブロック言語の選定基準

中身の内容から最も合致する言語を選ぶ。迷った場合は「その内容をエディタで開くとしたら何のシンタックスハイライトを当てるか」で判断する。

| 言語 | 内容の例 |
| --- | --- |
| `bash` | シェルコマンド、環境変数定義（`KEY=value`）、`.env` ファイルの内容 |
| `powershell` | PowerShell固有のコマンド（`& ".\venv\..."`） |
| `python` | Pythonコード |
| `json` | JSONデータ |
| `yaml` | YAMLデータ |
| `toml` | TOMLデータ（`pyproject.toml` 等） |
| `markdown` | Markdownテンプレート・出力フォーマット例 |
| `text` | ディレクトリツリー（`├──`）、フロー図（`→`）、ファイルパス例、その他どの言語にも該当しない内容 |

## 空白・フォーマット

- **MD009** no-trailing-spaces: 行末の空白を残さないこと
- **MD010** no-hard-tabs: タブ文字を使用しないこと（スペースに置換）
- **MD012** no-multiple-blanks: 連続する空行は1行までにすること
- **MD047** single-trailing-newline: ファイル末尾に改行を1つ入れること

## リンク・画像

- **MD011** no-reversed-links: リンク構文の括弧の順序を間違えないこと（`[text](url)`）
- **MD034** no-bare-urls: URLはリンク形式で記述すること（`[text](url)`）
- **MD039** no-space-in-links: リンクテキスト内の前後にスペースを入れないこと
- **MD042** no-empty-links: 空のリンクを作成しないこと
- **MD045** no-alt-text: 画像には代替テキスト（alt）を必ず指定すること
- **MD051** link-fragments: リンクフラグメントが有効な見出しを参照していること
- **MD052** reference-links-images: 参照リンクが定義済みのラベルを参照していること
- **MD053** link-image-reference-definitions: 未使用の参照リンク定義を残さないこと

## テーブル

- **MD055** table-pipe-style: テーブルのパイプ書式を統一すること
- **MD056** table-column-count: テーブルの列数を各行で統一すること
- **MD058** blanks-around-tables: テーブルの前後に空行を1行ずつ配置すること
- 区切り行の`|`と`-`の間に半角スペースを入れること（`| --- |`）

## 強調・インライン

- **MD036** no-emphasis-as-heading: 強調を見出しの代わりに使わないこと
- **MD037** no-space-in-emphasis: 強調マーカー内の前後にスペースを入れないこと
- **MD038** no-space-in-code: コードスパン内の前後にスペースを入れないこと
- **MD049** emphasis-style: 強調スタイルは`*`で統一すること
- **MD050** strong-style: 太字スタイルは`**`で統一すること

## ブロッククォート

- **MD027** no-multiple-space-blockquote: ブロッククォート記号の後のスペースは1つにすること
- **MD028** no-blanks-blockquote: ブロッククォート内に空行を入れないこと

## その他

- **MD033** no-inline-html: インラインHTMLの使用を避けること（必要な場合を除く）
- **MD035** hr-style: 水平線のスタイルを統一すること（`---`を推奨）
- **MD041** first-line-h1: ファイルの先頭行はトップレベル見出しにすること（YAMLフロントマターがある場合は除く）
- **MD044** proper-names: 固有名詞の大文字小文字を正しく表記すること

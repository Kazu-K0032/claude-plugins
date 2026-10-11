---
status: "承認済み"
date: YYYY-MM-DD
---

# ADR YYYY-MM-DD: php-coding-standards: WordPress Coding Standards を使い、整形の規則だけ外す

---

## 背景と問題提起

判断の種類: 新規の選定・方針

テーマと mu-plugins を PHP で書く。管理画面で入力された記事やカスタムフィールドの値を、そのまま画面に出す場面が多い。エスケープを忘れると、XSS（悪意のあるスクリプトが画面で動く攻撃）につながる。PHP の書き方の規約と、それを機械で確かめる Lint に何を使うか？

---

## 意思決定の要因

- WordPress の公式の規約に沿えること
- 出力のエスケープ・入力の無害化・nonce の確認の漏れを、機械で見つけられること
- 規則を 1 つの設定ファイルにまとめ、手元と CI で同じ規則を使えること

---

## 検討した選択肢

1. [WordPress Coding Standards（WPCS）](https://github.com/WordPress/WordPress-Coding-Standards)
2. [VIP Coding Standards（VIPCS）](https://github.com/Automattic/VIP-Coding-Standards)
3. [PSR-12](https://www.php-fig.org/psr/psr-12/)

---

## 却下した選択肢と理由

### VIPCS

- WordPress VIP（大規模サイト向けのホスティング）で動かすコードのための規約。VIP の環境に合わせた規則が多く、ふつうのホスティングでは使わない

### PSR-12

- PHP 全般の書き方の規約で、WordPress の関数（`esc_html()`・`sanitize_text_field()`・`wp_verify_nonce()` など）を知らない。そのため、エスケープや nonce の漏れを見つけられない

---

## 決定

決定：WordPress Coding Standards（WPCS）を使う。ただし、整形の規則（インデント・配列の書き方・Yoda 条件・括弧の内側の空白）は外す

理由：WordPress の公式がテーマとプラグインにも勧める規約で、WordPress の関数を知ったうえでセキュリティの漏れを見つけられるため

### 根拠

1. **WordPress の公式の規約に沿える**
    - 公式の PHP の規約は「They are mandatory for WordPress Core and we encourage you to use them for your themes and plugins as well.」（WordPress 本体では必須で、テーマとプラグインにも使うよう勧める）としている。Ref: [PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/)
2. **セキュリティの漏れを機械で見つけられる**
    - `WordPress.Security.EscapeOutput` がエスケープしていない出力を、`WordPress.Security.ValidatedSanitizedInput`・`WordPress.Security.NonceVerification` が無害化と nonce の確認の漏れを、エラーとして出す
3. **規則を共有できる**
    - PHP_CodeSniffer（PHP のコードを規則で確かめるツール）の設定 `wordpress/phpcs.xml.dist` に規則をまとめ、手元・Claude Code のフック・CI で同じ規則を使う

### 受け入れたトレードオフ

1. **WordPress 本体と違う整形にする**
    - WPCS はタブのインデント・`array()`・Yoda 条件・括弧の内側の空白を求める。エディタの整形と食い違い、直すたびに差分が増えるため、これらの規則は外した
    - 代わりに、スペース 4 つのインデントと `[]` の配列にそろえる規則を入れた。エスケープ・nonce・国際化の規則は残している
2. **名前に関わる設定が要る**
    - Text Domain（`my-theme`）を `phpcs.xml.dist` に書かないと、翻訳関数の検査が動かない。テーマを増やしたら足す
    - 関数名の接頭辞の規則は、テンプレートの中の変数にまで接頭辞を求めて誤った指摘が多いため、有効にしていない。接頭辞は `.claude/rules/wordpress.md` で守る
3. **保守する人が少ない**
    - WPCS 3.0.0 の作業の大半は、ほぼ 1 人の、ほとんど無報酬のコントリビューターが担った（2023 年 8 月）。Ref: [WP Tavern](https://wptavern.com/wordpress-coding-standards-maintainer-warns-maintenance-will-be-halted-without-funding-this-is-an-unsustainable-situation)

**それでも採用する理由**: エスケープの漏れによる XSS の害が、これらの手間より大きい。保守の状況は、WPCS の版を上げるときに確かめる

---

## 関連情報

- 置き換える ADR: なし
- 関連 ADR: なし
- 経緯の記録: なし
- 参考資料: 本文のリンクのとおり

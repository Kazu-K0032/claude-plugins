---
name: wordpress
description: WordPress のリポジトリに、wordpress/wp-content/ 配下のテーマ（クラシックテーマの最小構成）と mu-plugins の置き場所、Docker のローカル環境（MySQL・WordPress・WP-CLI。入れるかは実行時に聞く）、PHP の Lint（phpcs）の設定、置き場所・出力のエスケープ・入力の検証・国際化などをまとめた規約（.claude/rules/wordpress*.md）を導入する。WordPress のプロジェクトを立ち上げる時、または既存の WordPress リポジトリへ規約と Lint を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*), Bash(date:*), Bash(git ls-files:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象で、Docker は実行時に聞く。例: 規約だけ / Lint だけ / Docker なし / 既存は置き換えない）]"
---

# WordPress プロジェクトのセットアップ（wordpress）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/`）を実行中のリポジトリのルートへコピーし、テーマの仮の名前（`my-theme` など）を利用者が決めた名前に置き換える。**既存ファイルは承認なしに上書きしない**。

- 外へ書き込むもの：リポジトリのルートへのテンプレートのコピーと、承認を得た名前の置き換え・マージ・フックへの追記・ADR の追加
- 人がすること：導入計画と書き込みの承認、テーマの名前の決定、`DIFF` の扱いの選択、`composer`・`docker`・`wp` の実行、コミット、導入後の作業（手順 10）。Lint には PHP と Composer、ローカル環境には Docker と Docker Compose が要る

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/references/init-repo-first.md` | 手順 1 の最初 |
| `${CLAUDE_PLUGIN_ROOT}/references/install-flow.md` | 手順 1・3・4・6 |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/existing-layout.md` | 手順 1 で状態を決めるとき・手順 7 |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/placeholder-names.md` | 手順 2・5・6・7・9（仮の名前を置き換えるとき） |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/merge-policy.md` | 手順 6 で `DIFF` のファイルがあるとき（選択肢を示す前から）・導入済みの `wordpress.md` が 1 ファイル版のとき・手順 7 で既存のファイルに足すとき |
| `${CLAUDE_PLUGIN_ROOT}/references/lint-hook-shapes.md` | 手順 8 で、フックの形を見分けるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/hooks.md` | 手順 8 で、足す定義を書くとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/adr-steps.md` | 手順 9 |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/adr/php-coding-standards.md` | 手順 9 で、元にする ADR を読むとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/after-install.md` | 手順 10 |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/.claude/rules/` | 置き場所と実装の規約を確かめるとき。既存の構成に合わせて書き換えるときの元にもする |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/README.md` | 収録物・除外したものを確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | Markdown を書く・直すとき。その規約に従う |

## 想定している引数

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、Docker のローカル環境は手順 2 で聞き、`DIFF` は手順 6 で 1 件ずつ判断してもらう。範囲を絞ったときは、手順 4 で `--only` に `NEW` のファイルだけを並べる。

| 引数の例 | 対象・扱い |
| --- | --- |
| `規約だけ` | `.claude/rules/wordpress.md`・`wordpress-security.md`・`wordpress-templates.md` だけ |
| `Lint だけ` | `wordpress/composer.json`・`wordpress/phpcs.xml.dist` だけ（手順 8 のフックも対象）。`vendor/`・`auth.json` が Git の対象外になっていなければ、`.gitignore` に足す案を出す |
| `Docker なし` | `wordpress/compose.yaml`・`wordpress/.env.example` を入れない。手順 2 で聞かない |
| `既存は置き換えない` | `DIFF` はすべて据え置き、手順 6 の衝突の片付けを飛ばす。古い 1 ファイル版の規約の片付けは行う。手順 8 のフックと手順 9 の ADR の一覧は、既存のファイルでも追記する |

## 手順

### 1. 現状を確かめる

`init-repo-first.md` で土台の有無を確かめ、`install-flow.md` の「状態を確かめる」に従って `--skill wordpress --check` を実行する。あわせて `existing-layout.md` に従って既存の WordPress を探し、状態を決める。

- A：WordPress のファイルが無い → テンプレート全体を入れる
- B：`wordpress/wp-content/` に既存のテーマがある → テーマの雛形を入れない
- C：別の場所に既存の構成がある → ファイルを動かさず、規約だけを入れて手順 7 で今の場所に合わせる

ローカル環境のファイルが既にあれば、状態にかかわらず Docker の雛形を入れない。2 つ目の構成ができ、どちらで起動するかが分からなくなるため。

### 2. テーマの名前とローカル環境を決める

`placeholder-names.md` に従い、A ではスラッグと表示名を聞き、B・C では既存のテーマから名前を調べる。A・B で、ローカル環境のファイルが無く、引数に `Docker なし` も無ければ、Docker でローカル環境を作るかを `AskUserQuestion` で聞く。

| 選択肢 | 扱い |
| --- | --- |
| 作る（推奨） | `wordpress/compose.yaml`・`wordpress/.env.example` を入れる |
| 作らない | 入れない。Local・wp-env など、別の方法で動かす場合 |

### 3. 導入計画を示して承認を得る（必須）

`install-flow.md` の「導入計画を示す」に従って示し、承認を得る。あわせて、手順 1 の状態と入れないファイル、手順 2 のローカル環境、手順 5 の置き換え後の名前、手順 8 でフックに足すもの、手順 9 で ADR を足す場所を示す。

### 4. コピーする

`install-flow.md` の「コピーする」に従う。次の場合は、入れるファイルを `--only` に並べる。

- B：テーマの雛形を除いた `NEW`
- C：規約の 3 つだけ
- Docker の雛形を入れない：`wordpress/compose.yaml`・`wordpress/.env.example` を除いた `NEW`
- 範囲を絞った：引数で指定した範囲の `NEW`

2 回目以降の実行では、名前を変えたテーマは `wordpress/wp-content/themes/my-theme/` 配下が `NEW` に、置き換えたファイルは `DIFF` に出る。テーマの雛形は B と同じく入れず、仮の名前だけの差分は据え置く。

### 5. 仮の名前を置き換える

この実行でコピーしたファイルだけを対象に、`placeholder-names.md` の「置き換える」に従って置き換える。既存のファイルは変えない。

### 6. 衝突したファイルを片付ける

`install-flow.md` の「衝突したファイルを片付ける」に従い、マージは `merge-policy.md` の方針で行う。テンプレートは仮の名前のままのため、名前だけの差分は差分として扱わない。導入済みの `.claude/rules/wordpress.md` が 1 ファイル版なら、`merge-policy.md` の「古い 1 ファイル版の片付け」にも従う（`既存は置き換えない` のときも）。

### 7. 今の場所に合わせる（C の場合）

`existing-layout.md` の「今の場所に合わせる」に従い、規約のパスを書き換え、Lint の設定と `.gitignore` を今の構成に作る案を出す。

### 8. フックに PHP の Lint と Docker の検出を足す

`lint-hook-shapes.md` でフックの形を見分け、`hooks.md` の定義を足す案を差分で示し、承認を得てから足す。

### 9. Lint の規則を決めた理由を ADR に足す

この実行で `phpcs.xml.dist` を入れた場合は、`adr-steps.md` に従い、元の ADR から利用先の ADR を作る。入れていなければ飛ばす。

### 10. 導入後にやることを伝える

`after-install.md` の残作業を示す。最後に、手順 3 と同じテンプレートのリンクを添える。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存のテーマ・mu-plugins のファイルを移動・改名しない
- `composer`・`docker`（`docker compose` を含む）・`wp`（WP-CLI）と、本番への反映（FTP・rsync など）を実行しない。依存やイメージの取得・DB の書き換え・本番の変更を伴うため、人が実行する
- コピー結果をコミットしない（コミットは人が行う）
- ファイルを消さない

$ARGUMENTS

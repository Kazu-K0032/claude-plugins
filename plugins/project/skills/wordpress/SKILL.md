---
name: wordpress
description: WordPress のリポジトリに、wordpress/wp-content/ 配下のテーマ（クラシックテーマの最小構成）と mu-plugins の置き場所、Docker のローカル環境（MySQL・WordPress・WP-CLI。入れるかは実行時に聞く）、PHP の Lint（phpcs）の設定、置き場所・出力のエスケープ・入力の検証・国際化などをまとめた規約（.claude/rules/wordpress*.md）を導入する。WordPress のプロジェクトを立ち上げる時、または既存の WordPress リポジトリへ規約と Lint を後から入れる時に使用する
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Bash(git status:*), Bash(diff:*), Bash(date:*), Bash(git ls-files:*)
argument-hint: "[導入する範囲・既存ファイルの扱い（任意。省略時はテンプレート全体が対象で、Docker は実行時に聞く。例: 規約だけ / Lint だけ / Docker なし / 既存は置き換えない）]"
---

# WordPress プロジェクトのセットアップ（wordpress）

同梱テンプレート（`${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/`）を、実行中のリポジトリのルートへコピーし、テーマの仮の名前（`my-theme` など）を利用者が決めた名前に置き換える。**既存ファイルは承認なしに上書きしない**。

- 外へ書き込むもの：利用先のリポジトリのファイル（テンプレートのコピー、承認を得て足すフックと ADR）。`tmp/` と GitHub には書かない
- 人がすること：導入計画・衝突したファイル・フック・ADR の承認、`composer`・`docker`・`wp` の実行、本番への反映、コミット

## 参照ファイル

| ファイル | いつ読むか |
| --- | --- |
| `${CLAUDE_PLUGIN_ROOT}/references/markdown.md` | 最初に Read する。書く Markdown（README の行・ADR）は、その規約に従う |
| `${CLAUDE_PLUGIN_ROOT}/scripts/install.sh` | 手順 1・4 で実行する。状態判定（NEW / SAME / DIFF）とコピーを行う。project プラグインの全 Skill で共有するため、`--skill wordpress` で対象を指定する |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/` | コピー元のテンプレート一式。手順 3・10 で、中身を確かめるリンクを示す |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/files/.claude/rules/` | 置き場所と実装の規約（`wordpress.md`・`wordpress-security.md`・`wordpress-templates.md`）。既存の構成に合わせて書き換えるときの元にもする |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/adr/php-coding-standards.md` | 手順 9 で ADR を書くとき。Lint の規則（WPCS を使い、整形の規則などを外す）を決めた理由の ADR |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/README.md` | 収録物の一覧・除外したものとその理由を確かめるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/install-scope.md` | 引数が渡されたとき、手順 4 でコピーするファイルを `--only` で絞るとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/detection.md` | 手順 1 で、土台・`--check` のラベル・既存の WordPress から A・B・C を決めるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/names.md` | 手順 2 でテーマの名前を決めるとき、手順 5 で仮の名前を置き換えるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/conflicts.md` | 手順 6 で `DIFF` を片付けるとき、手順 7 で C の場合に今の場所へ合わせるとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/hooks.md` | 手順 8 で、フックに PHP の Lint と Docker の検出を足すとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/add-adr.md` | 手順 9 で、ADR の置き場所を決めて書くとき |
| `${CLAUDE_PLUGIN_ROOT}/skills/wordpress/post-install.md` | 手順 10 で、導入後の残作業を提示するとき |

## 想定している引数

引数は「どのファイルを入れるか」と「既存物をどうするか」の指定として読む。省略時はテンプレート全体が対象で、Docker のローカル環境は手順 2 で聞く。`DIFF` は手順 6 で 1 件ずつ判断してもらう。`規約だけ`・`Lint だけ`・`Docker なし`・`既存は置き換えない` の対象・扱いは `install-scope.md` を読む。

## 手順

### 1. 現状を確認する

最初に、土台の `.claude/settings.json` があるかを Glob で確かめる。無ければ、`AskUserQuestion` で聞く。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill wordpress --check
```

あわせて、既存の WordPress を Glob で探し、プラグインを Git で管理しているかを確かめ、状態（A：WordPress のファイルが無い、B：`wordpress/wp-content/` に既存のテーマがある、C：別の場所に既存の構成がある）を決める。土台が無いときの選択肢・`--check` のラベル・探すパターン・A・B・C の扱いは `detection.md` を読む。

`install.sh` は、リポジトリの**ルート**で実行する（サブディレクトリで実行するとスクリプトが停止する）。`git` / `bash` が利用可能であること。

### 2. テーマの名前とローカル環境を決める

A の場合は、利用者にテーマのスラッグと表示名を聞く。B・C の場合は、既存のテーマから名前を調べる。分からないものは利用者に聞き、推測で埋めない。名前の決め方は `names.md` を読む。

A・B の場合で、ローカル環境のファイルが無く、引数に `Docker なし` も無ければ、Docker でローカル環境を作るかを `AskUserQuestion` で聞く。

| 選択肢 | 扱い |
| --- | --- |
| 作る（推奨） | `wordpress/compose.yaml`・`wordpress/.env.example` を入れる |
| 作らない | 入れない。Local・wp-env など、別の方法で動かす場合 |

### 3. 導入計画を提示して承認を得る（必須）

`--check` の結果を、新規作成するファイル（`NEW`）・既存のまま残すファイル（`SAME`）・衝突していて判断が要るファイル（`DIFF`）に分けて提示する。あわせて、手順 1 の状態（A・B・C）と入れないファイル、手順 2 で決めたローカル環境、手順 5 の置き換え後の名前、手順 8 でフックに PHP の Lint と Docker の検出を足すか、手順 9 で ADR を足す場所を示す。

テンプレートの中身を確かめられるよう、`https://github.com/Kazu-K0032/claude-plugins/tree/v<版>/plugins/project/skills/wordpress/files` も示す。`<版>` は `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` の `version` にする。入れている版と同じ中身を見せるため。リリース前の版ではタグが無く、開けない。

### 4. コピーする

承認を得たら、まだ存在しないファイルだけをコピーする。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" --skill wordpress --apply
```

B・C、Docker の雛形を入れない場合、範囲を絞った場合は、入れるファイルを `--only` に列挙する。`--only` は「差分を承知で上書きする」という明示指定として扱われる。並べるファイルは `install-scope.md` を読む。

### 5. 仮の名前を置き換える

手順 2 で決めた名前で、コピーしたファイルの仮の名前を置き換える。この実行でコピーしたファイルだけを対象にし、既存のファイルは変えない。置き換える名前の表と、置き換えの手順は `names.md` を読む。

### 6. 衝突したファイルを片付ける

`DIFF` は 1 件ずつ差分を見せ、ユーザーに「上書き / 手でマージ / 据え置き」を選ばせる。テンプレートは仮の名前のままのため、名前だけの差分は差分として扱わない。ファイル別のマージ方針は `conflicts.md` を読む。

### 7. 今の場所に合わせる（C の場合）

コピーした `.claude/rules/wordpress*.md` の、frontmatter の `paths` と、本文の `wordpress/` で始まるパスを、今の構成の場所に書き換える。Lint の設定（`composer.json`・`phpcs.xml.dist`）と `.gitignore` は、今の構成の WordPress のルートに作る案を出す。作り方は `conflicts.md` を読む。

### 8. フックに PHP の Lint と Docker の検出を足す

`phpcs` を動かす定義が無ければ、フックの形に合わせて足す案を差分で示し、承認を得てから足す。Docker の雛形を入れた、またはローカル環境のファイルがあれば、`guard-destructive.sh` への Docker の検出も同じく案を示して足す。フックの形ごとの足し方と、足す定義は `hooks.md` を読む。

### 9. Lint の規則を決めた理由を ADR に足す

この実行で `phpcs.xml.dist` を入れた場合は、`${CLAUDE_PLUGIN_ROOT}/skills/wordpress/adr/php-coding-standards.md` を元に、規則を決めた理由を ADR として足す。あとから「なぜ整形の規則を外したか」を確かめられるようにするため。`phpcs.xml.dist` を入れていなければ飛ばす。置き場所の決め方と書き方は `add-adr.md` を読む。

### 10. 導入後にやることを伝える

コピーが終わったら、残作業をユーザーに提示する。済んでいる項目は省く。コマンドは人が実行する。最後に、手順 3 と同じテンプレートのリンクを添える。残作業の項目は `post-install.md` を読む。

## 禁止事項

- `--only` の明示指定なしに既存ファイルを上書きしない
- 既存のテーマ・mu-plugins のファイルを移動・改名しない
- `composer`・`docker`（`docker compose` を含む）・`wp`（WP-CLI）と、本番への反映（FTP・rsync など）を実行しない。依存やイメージの取得・DB の書き換え・本番の変更を伴うため、人が実行する
- コピー結果をコミットしない（コミットは人が行う）
- ファイルを消さない

$ARGUMENTS

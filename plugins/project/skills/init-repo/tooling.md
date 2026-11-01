# エディタ設定・Lint と整形のツール・スペルチェックの除外語

`init-repo` の手順 5 で、`.vscode/`・`cspell.json`・`lefthook.yml` を入れた（または既にある）ときに使う。どれも、プロジェクトに合わせた中身の一覧を見せ、承認を得てから書き込む。手順 2 で入れ方を示すときは、「ツールを入れる」の節を使う。

- [推奨拡張機能（.vscode/extensions.json）](#推奨拡張機能vscodeextensionsjson)
- [Lint と整形のツール（lefthook.yml の claude-edit）](#lint-と整形のツールlefthookyml-の-claude-edit)
  - [整形のツールが LF を求めるとき（.gitattributes）](#整形のツールが-lf-を求めるときgitattributes)
- [ツールを入れる](#ツールを入れる)
- [スペルチェックの除外語（cspell.json の words）](#スペルチェックの除外語cspelljson-の-words)

## 推奨拡張機能（.vscode/extensions.json）

ルートのファイルから技術スタックを判定し、`recommendations` に足す拡張機能を提案する。

| 判定に使うファイル | 提案する拡張機能の例 |
| --- | --- |
| `package.json`（`eslint` / `prettier` / `typescript` / `tailwindcss` 等の依存） | `dbaeumer.vscode-eslint`・`esbenp.prettier-vscode`・`bradlc.vscode-tailwindcss` |
| `pyproject.toml` / `requirements.txt` | `ms-python.python`・`charliermarsh.ruff` |
| `go.mod` | `golang.go` |
| `Cargo.toml` | `rust-lang.rust-analyzer` |
| `*.tf` | `hashicorp.terraform` |
| `Dockerfile` / `compose.yaml` | `ms-azuretools.vscode-docker` |

表にない技術は、公式に推奨されている拡張機能を調べてから提案する。拡張機能 ID の推測で書かない。

## Lint と整形のツール（lefthook.yml の claude-edit）

土台が持つのは、推論（Claude）と機械の検査を分ける仕組みだけである。どのツールを使うかはプロジェクトが決めるため、次の順で決めて `claude-edit` の `commands` に足す。別名の設定（`.lefthook.yml` など）を使っているときは、そのファイルに足す。`claude-edit` が無ければ、`piped: true` と一緒に定義ごと足す。

1. 引数でツールを指定されていれば、それを使う
1. 指定が無ければ、既存の設定を Glob で探す（例：`biome.json`・`.oxlintrc.json`・`eslint.config.*`・`.prettierrc*`・`ruff.toml`・`pyproject.toml`・`.golangci.*`、`package.json` の `scripts` の `lint`・`format`）。あれば、それを使う
1. どちらも無ければ、`AskUserQuestion` で候補を出す。「使わない」も選択肢に入れる。候補は、公式の文書で今の状態（安定版か・最新の版）を確かめてから出す。状態や版を推測で書かない。JS/TS の例：整形は oxfmt（ベータ）、Lint は oxlint、両方を 1 つで扱う Biome

`commands` は次の決まりで書く。

- 整形のツールはファイルを書き換える形にし、`priority: 1` にする。Lint のツールは、警告でも 0 以外で終える形（例：oxlint の `--deny-warnings`）にし、`priority: 2` にする。失敗した結果だけが Claude に返る
- ツールが入っていないときは黙って飛ばす。`npm` で入れたツールは PATH に無いため、`node_modules/.bin/` の下を指す
- `node_modules` を作れないときは、`npx --yes <パッケージ>@<版>` で版を固定して流し、`npx` が無ければ黙って飛ばす。版を固定しないと毎回最新版を取りに行き、手元の Node と合わなくなることがあるため。`--yes` は、取得の確認で止まらないために付ける
- `run` に二重引用符を書かない。Windows では、二重引用符を含むコマンドが崩れる。全体を単一引用符で囲む
- ツールの置き場所がルートでないときは、`root` にそのディレクトリを書く。`{staged_files}` は `root` からの相対パスになる。`glob` は `root` に関係なく、リポジトリのルートから数える

```yaml
claude-edit:
  piped: true
  commands:
    format:
      priority: 1
      glob: "*.{js,jsx,ts,tsx}"
      run: '[ -x node_modules/.bin/oxfmt ] || exit 0; node_modules/.bin/oxfmt {staged_files}'
    lint:
      priority: 2
      glob: "*.{js,jsx,ts,tsx}"
      run: '[ -x node_modules/.bin/oxlint ] || exit 0; node_modules/.bin/oxlint --deny-warnings {staged_files}'
```

`npx` で流すときの例（Prettier と ESLint）。`<版>` は、公式の文書で確かめてから書く。ESLint などの設定そのものは、プロジェクトが持つものを使う。

```yaml
claude-edit:
  piped: true
  commands:
    format:
      priority: 1
      glob: "*.{js,jsx,ts,tsx}"
      run: 'command -v npx >/dev/null || exit 0; npx --yes prettier@<版> --write {staged_files}'
    lint:
      priority: 2
      glob: "*.{js,jsx,ts,tsx}"
      run: 'command -v npx >/dev/null || exit 0; npx --yes eslint@<版> --max-warnings 0 {staged_files}'
```

### 時間切れの目安（timeout）

`settings.json` の PostToolUse の `timeout` は、既定で 60 秒にしてある。時間切れで打ち切られると、Lint の結果は Claude に返らず、Claude も利用者もその場で気づけないため、`claude-edit` が 1 回の編集で終わる時間より十分に長くする。

- `npx` の形は、初回にパッケージの取得が走って遅い。時間は、2 回目以降で比べる
- 重いツール（型検査・cspell など）を足したら、「動くかを確かめる」で時間を測る。`timeout` に近ければ、延ばすことを提案する
- Claude Code の既定（600 秒）ほどは延ばさない。編集のたびに、長く待たされるため

### 整形のツールが LF を求めるとき（.gitattributes）

決めた整形のツールが既定で LF に整形するとき（Prettier・Biome など）は、`.gitattributes` に足す行も一緒に提案する。`core.autocrlf=true` の Windows では作業ツリーのファイルが CRLF になり、整形の検査（`prettier --check` など）が全件で失敗するため。既定の改行は、ツールの公式の文書で確かめる。推測で書かない。

- 足す行は、`claude-edit` の整形の `glob` と同じ拡張子を、`*.<拡張子> text eol=lf` の形で 1 行ずつにする（例：`*.js text eol=lf`）。`* text=auto eol=lf` にはしない。Windows で CRLF が要る `.bat` などを巻き込まず、renormalize の差分も小さくするため
- 既存の `.gitattributes` に同じ拡張子の行があるときの扱いは、`merge-policy.md` の `.gitattributes` の行に従う
- ほかの提案と同じく、足す行の一覧を見せて承認を得てから書き込む
- Prettier の `endOfLine: auto` などの、ツール側で改行を許す設定は示さない。作業ツリーの CRLF が残り、ツールごとに設定の名前も違うため
- CRLF でコミット済みのファイルがあれば、手順 6 で `after-install.md` の renormalize を案内する

## ツールを入れる

lefthook と、上の節で決めたツールは、手順 2 で選んでもらった方法で入れる。「自分で入れる」が選ばれたら、ここでは入れず、手順 6 で伝える。「Claude が入れる」が選ばれたら、手順 5 で `lefthook.yml` に書き込んだ後に入れる。

### 入れ方を決める

| 導入先 | lefthook | Lint・整形のツール |
| --- | --- | --- |
| `package.json` がある | npm の devDependencies | npm の devDependencies |
| `package.json` が無い（Windows） | `winget install evilmartians.lefthook` | ツールの公式の文書にある入れ方 |
| `package.json` が無い（macOS） | `brew install lefthook` | ツールの公式の文書にある入れ方 |
| `package.json` が無い（Linux） | Homebrew があれば `brew install lefthook`。無ければ人が入れる | ツールの公式の文書にある入れ方 |

- `package.json` があれば npm にする。devDependencies に入るため、チームで同じ版がそろう
- ほかの入れ方は [導入の方法](https://lefthook.dev/install/) にある。表に無い入れ方を選ばれたら、それに従う

### Claude が入れるとき

- npm で lefthook を入れるときは、`npm install --save-dev --ignore-scripts lefthook` にする。npm 版は、入れたときに `lefthook install` を動かして `.git/hooks` を書き換えるため。`.git/` の書き換えは人が行う。`LEFTHOOK=0` では止まらない
- Lint・整形のツールは、lefthook と別のコマンドで入れる。`--ignore-scripts` は、同じコマンドで入れる全部のパッケージに効くため
- 同意や管理者の権限を求められて止まったら、入れずに「自分で入れる」の流れに切り替え、手順 6 で伝える。同意するかは人が決めるため
- 入れたら、`package.json` の差分を示す

### 動くかを確かめる

入れたら、`claude-edit` の `glob` に当たる既存のファイルを 1 つ選び、フックと同じ探し方で動かす。フックは、lefthook やツールが見つからないと黙って何もしないため、入れただけでは動くかが分からない。

1. `command -v lefthook` で探し、無ければ `node_modules/.bin/lefthook` を使う。どちらも無ければ、フックは動かない
1. 見つけた lefthook で、フックと同じコマンドを動かす。出力に、どのコマンドが動いたかが出る

```bash
<lefthook> run claude-edit --no-auto-install --file <ファイル>
```

- ツールの実行ファイル（`node_modules/.bin/<ツール>` など）があるかも確かめる。`npx` の形なら、`command -v npx` で `npx` があるかを確かめる。`run` は、ツールが無いと黙って飛ばすため
- 上のコマンドを 2 回動かし、2 回目にかかった時間を、「時間切れの目安」に照らす。打ち切られると、フックの結果が Claude に返らないため
- 整形のツールがファイルを書き換えたら、`git diff <ファイル>` を示す。戻すかは人が決める
- winget で入れたときは、Claude Code を再起動するまで PATH が効かず、lefthook が見つからない。再起動してから確かめるよう、手順 6 で伝える

## スペルチェックの除外語（cspell.json の words）

除外語は `.vscode/settings.json` の `cSpell.words` ではなく `cspell.json` に置く。VS Code の拡張機能と cspell の CLI（`pr-checks.yml` のスペルチェック）の両方が読むのは `cspell.json` だけのため。テンプレート自身が使う語（`aidd`・`ssot` 等）は登録済み。

次から固有名詞・技術用語の候補を集め、重複を除いて小文字で並べる。

- `package.json` などの依存パッケージ名・プロジェクト名
- ルート直下のディレクトリ名・主要なファイル名
- `README.md` / `CLAUDE.md` / `docs/` に出てくるサービス名・製品名・略語
- 上の節で `lefthook.yml` に書いたツール名・オプション（PR のスペルチェックは `lefthook.yml` も検査する）

`npx` が使える環境では、次の結果も候補に加えてよい（初回はパッケージの取得が走る）。

```bash
npx --yes cspell@9.8.0 lint --no-progress --words-only --unique --dot --gitignore --exclude ".git/**" "**/*.{md,ts,tsx,js,jsx,py,go,rs,json,yml,yaml}"
```

- 版は `pr-checks.yml` のスペルチェックとそろえる。版を固定しないと最新版が使われ、最新版が要求する Node より手元の Node が古いと失敗する
- `--dot` は `.claude/`・`.github/` などドット始まりのディレクトリも対象にする（既定では検査しない）。`--exclude ".git/**"` は、そのときに `.git/` の中まで検査しないためのもの
- 9.8.0 は Node 20.18 以上を求めるため、それより古い Node では `Unsupported NodeJS version` で失敗する。失敗したら、この洗い出しは飛ばし、上の一覧の候補だけで進める。洗い出しは候補を増やす補助で、なくても除外語を登録できるため

一般的な英単語の誤字は候補から外す。除外語に入れるのは「正しい綴りだが辞書に無い語」だけ。`pr-checks.yml` を入れた場合、ここで登録しなかった語は PR のスペルチェックで誤字として出る。
